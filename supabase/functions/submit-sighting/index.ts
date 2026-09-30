import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import { differenceHash } from '../_shared/imageHash.ts'
import { parseSightingForm, photoPlacement } from '../_shared/pipeline.ts'
import { selectVerifier } from '../_shared/selectVerifier.ts'
import { VerifierUnavailableError, type VerificationResult } from '../_shared/verification.ts'

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      if (req.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 })

      const userId = ctx.userClaims!.id
      const admin = ctx.supabaseAdmin
      let form: FormData
      try {
        form = await req.formData()
      } catch {
        return Response.json({ error: 'bad_request' }, { status: 400 })
      }
      const parsed = await parseSightingForm(form)
      if (!parsed.ok) return Response.json({ error: 'bad_request' }, { status: 400 })
      const { input, photo } = parsed

      // 1. Tanie kontrole przed wywołaniem modelu.
      let phash: string
      try {
        phash = differenceHash(photo)
      } catch {
        // Uszkodzony lub nie-JPEG plik: błąd klienta, nie serwera.
        return Response.json({ error: 'bad_request' }, { status: 400 })
      }
      const { data: blocked, error: precheckError } = await admin.rpc('precheck_sighting', {
        p_user_id: userId,
        p_lon: input.lon,
        p_lat: input.lat,
        p_accuracy_m: input.accuracyM,
        p_phash: phash,
      })
      if (precheckError) throw precheckError
      if (blocked) return Response.json({ status: 'blocked', reason: blocked })

      // 2. Model; gdy chwilowo niedostępny, zgłoszenie zostaje jako „pending”.
      const verifier = selectVerifier((key) => Deno.env.get(key))
      let verification: VerificationResult | null = null
      try {
        verification = await verifier.verify(photo)
      } catch (error) {
        if (!(error instanceof VerifierUnavailableError)) throw error
        console.warn(error.message)
      }

      // 3. Zdjęcie do właściwego bucketu, potem zapis i naliczenie punktów w jednej transakcji SQL.
      const id = crypto.randomUUID()
      const place = photoPlacement(userId, id, verification)
      const upload = await admin.storage.from(place.bucket).upload(place.path, photo, { contentType: 'image/jpeg' })
      if (upload.error) throw upload.error

      const { data: result, error: recordError } = await admin.rpc('record_sighting', {
        p_id: id,
        p_user_id: userId,
        p_lon: input.lon,
        p_lat: input.lat,
        p_accuracy_m: input.accuracyM,
        p_captured_at: input.capturedAt,
        p_photo_bucket: place.bucket,
        p_photo_path: place.path,
        p_phash: phash,
        p_verifier: verifier.name,
        p_verification: verification,
      })
      if (recordError || result?.status === 'blocked') {
        await admin.storage.from(place.bucket).remove([place.path])
      }
      if (recordError) throw recordError

      return Response.json(result)
    } catch (error) {
      // Wyjątek z handlera nie dostałby nagłówków CORS i przeglądarka pokazałaby „brak połączenia”.
      console.error('submit-sighting: nieobsłużony błąd', error)
      return Response.json({ error: 'internal' }, { status: 500 })
    }
  }),
}
