import { supabase } from '../lib/supabase'

// Usuwa konto na serwerze (zdjęcia, zgłoszenia, raciki, osiągnięcia); true, gdy się udało.
export async function deleteAccount(): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('delete-account', { body: {} })
  return !error && (data as { deleted?: boolean } | null)?.deleted === true
}
