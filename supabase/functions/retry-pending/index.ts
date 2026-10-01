import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import { photoPlacement } from '../_shared/pipeline.ts'
import { selectVerifier } from '../_shared/selectVerifier.ts'
import { isPublicCandidate, VerifierUnavailableError } from '../_shared/verification.ts'

interface PendingSighting {
  id: string
  photo_bucket: string
  photo_path: string
}

// Wywoływana przez aplikację przy starcie: rozstrzyga zaległe zgłoszenia zalogowanej osoby.
export default {
  fetch: withSupabase({ auth: 'user' }, async (_req, ctx) => {
    try {
      const userId = ctx.userClaims!.id
      const admin = ctx.supabaseAdmin

      const { data, error } = await admin.rpc('list_pending_sightings', { p_user_id: userId })
      if (error) throw error
      const pending = (data ?? []) as PendingSighting[]
      if (pending.length === 0) return Response.json({ resolved: 0 })

      const verifier = selectVerifier((key) => Deno.env.get(key))
      let resolved = 0

      for (const sighting of pending) {
        try {
          const download = await admin.storage.from(sighting.photo_bucket).download(sighting.photo_path)
          if (download.error) throw download.error
          const photo = new Uint8Array(await download.data.arrayBuffer())

          let verification
          try {
            verification = await verifier.verify(photo)
          } catch (verifyError) {
            if (!(verifyError instanceof VerifierUnavailableError)) throw verifyError
            const { error: failError } = await admin.rpc('fail_verification', { p_id: sighting.id })
            if (failError) throw failError
            continue
          }

          // Publiczne zdjęcie najpierw kopiujemy (idempotentnie), źródło usuwamy dopiero po zapisie w bazie.
          let place = { bucket: sighting.photo_bucket, path: sighting.photo_path }
          let moved = false
          if (isPublicCandidate(verification)) {
            const target = photoPlacement(userId, sighting.id, verification)
            const upload = await admin.storage
              .from(target.bucket)
              .upload(target.path, photo, { contentType: 'image/jpeg', upsert: true })
            if (upload.error) throw upload.error
            moved = target.bucket !== sighting.photo_bucket || target.path !== sighting.photo_path
            place = target
          }

          const { data: outcome, error: resolveError } = await admin.rpc('resolve_pending', {
            p_id: sighting.id,
            p_photo_bucket: place.bucket,
            p_photo_path: place.path,
            p_verifier: verifier.name,
            p_verification: verification,
          })
          if (resolveError) throw resolveError

          if (!(outcome as { applied?: boolean } | null)?.applied) {
            // Kto inny rozstrzygnął zgłoszenie pierwszy: nic nie liczymy i nie ruszamy prywatnego źródła.
            // Własną publiczną kopię kasujemy, o ile wiersz na nią nie wskazuje (zwycięzca mógł wgrać ten sam plik).
            if (moved) {
              const { data: current } = await admin
                .from('sightings')
                .select('photo_bucket, photo_path')
                .eq('id', sighting.id)
                .single()
              if (current?.photo_bucket !== place.bucket || current?.photo_path !== place.path) {
                const cleanup = await admin.storage.from(place.bucket).remove([place.path])
                if (cleanup.error) console.error(`retry-pending: public copy cleanup failed for ${sighting.id}`, cleanup.error)
              }
            }
            continue
          }
          resolved += 1

          if (moved) {
            const removal = await admin.storage.from(sighting.photo_bucket).remove([sighting.photo_path])
            if (removal.error) console.error(`retry-pending: cleanup failed for ${sighting.id}`, removal.error)
          }
        } catch (sightingError) {
          console.error(`retry-pending: sighting ${sighting.id} failed`, sightingError)
        }
      }

      return Response.json({ resolved })
    } catch (error) {
      // Wyjątek z handlera nie dostałby nagłówków CORS i przeglądarka pokazałaby „brak połączenia”.
      console.error('retry-pending: nieobsłużony błąd', error)
      return Response.json({ error: 'internal' }, { status: 500 })
    }
  }),
}
