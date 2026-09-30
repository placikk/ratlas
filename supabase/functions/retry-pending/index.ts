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
    const userId = ctx.userClaims!.id
    const admin = ctx.supabaseAdmin

    const { data, error } = await admin.rpc('list_pending_sightings', { p_user_id: userId })
    if (error) throw error
    const pending = (data ?? []) as PendingSighting[]
    if (pending.length === 0) return Response.json({ resolved: 0 })

    const verifier = selectVerifier((key) => Deno.env.get(key))
    let resolved = 0

    for (const sighting of pending) {
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

      let place = { bucket: sighting.photo_bucket, path: sighting.photo_path }
      if (isPublicCandidate(verification)) {
        const target = photoPlacement(userId, sighting.id, verification)
        const move = await admin.storage
          .from(sighting.photo_bucket)
          .move(sighting.photo_path, target.path, { destinationBucket: target.bucket })
        if (move.error) throw move.error
        place = target
      }

      const { error: resolveError } = await admin.rpc('resolve_pending', {
        p_id: sighting.id,
        p_photo_bucket: place.bucket,
        p_photo_path: place.path,
        p_verifier: verifier.name,
        p_verification: verification,
      })
      if (resolveError) throw resolveError
      resolved += 1
    }

    return Response.json({ resolved })
  }),
}
