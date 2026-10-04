import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import { chunk, groupPathsByBucket, type StoredPhoto } from '../_shared/storageCleanup.ts'

// Usuwa konto zalogowanej osoby: najpierw jej zdjęcia ze Storage, potem konto auth.
// Profil, zgłoszenia, dziennik racików, zgłoszenia nadużyć i osiągnięcia znikają kaskadą.
export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 })
    try {
      const userId = ctx.userClaims!.id
      const admin = ctx.supabaseAdmin

      const { data, error } = await admin.rpc('list_my_photo_paths', { p_user_id: userId })
      if (error) throw error

      for (const [bucket, paths] of groupPathsByBucket((data ?? []) as StoredPhoto[])) {
        for (const batch of chunk(paths, 100)) {
          const removal = await admin.storage.from(bucket).remove(batch)
          if (removal.error) console.error(`delete-account: nie udało się usunąć zdjęć z ${bucket}`, removal.error)
        }
      }

      const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
      if (deleteError) throw deleteError

      return Response.json({ deleted: true })
    } catch (error) {
      console.error('delete-account: nieobsłużony błąd', error)
      return Response.json({ error: 'internal' }, { status: 500 })
    }
  }),
}
