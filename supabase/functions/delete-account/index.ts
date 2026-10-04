import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import { deleteAccountData, PRIVATE_BUCKET } from '../_shared/accountDeletion.ts'
import type { StoredPhoto } from '../_shared/storageCleanup.ts'

// Usuwa konto zalogowanej osoby: najpierw jej zdjęcia ze Storage, potem konto auth.
// Profil, zgłoszenia, dziennik racików, zgłoszenia nadużyć i osiągnięcia znikają kaskadą.
export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 })
    try {
      const userId = ctx.userClaims!.id
      const admin = ctx.supabaseAdmin

      const result = await deleteAccountData({
        userId,
        listPhotoPaths: async () => {
          const { data, error } = await admin.rpc('list_my_photo_paths', { p_user_id: userId })
          if (error) throw error
          return (data ?? []) as StoredPhoto[]
        },
        listPrivateFolder: async (offset, limit) => {
          const { data, error } = await admin.storage.from(PRIVATE_BUCKET).list(userId, { limit, offset })
          if (error) throw error
          return (data ?? []).map((object) => object.name)
        },
        removeFromBucket: async (bucket, paths) => {
          const { error } = await admin.storage.from(bucket).remove(paths)
          return error
        },
        deleteUser: async () => {
          const { error } = await admin.auth.admin.deleteUser(userId)
          return error
        },
      })
      if (!result.deleted) {
        console.error('delete-account: usuwanie przerwane', result.error)
        return Response.json({ error: 'internal' }, { status: 500 })
      }

      return Response.json({ deleted: true })
    } catch (error) {
      console.error('delete-account: nieobsłużony błąd', error)
      return Response.json({ error: 'internal' }, { status: 500 })
    }
  }),
}
