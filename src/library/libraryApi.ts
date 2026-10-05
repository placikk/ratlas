import { supabase } from '../lib/supabase'

export type ItemType = 'knowledge_card' | 'quiz' | 'pin_skin' | 'title'

export interface CatalogItem {
  id: string
  type: ItemType
  name: string
  teaser: string
  price: number
  preview: string | null
  owned: boolean
  equipped: boolean
}

export type PurchaseResult = 'purchased' | 'owned' | 'insufficient' | 'not_found' | 'error'
export type EquipResult = 'ok' | 'not_owned' | 'invalid' | 'error'

export interface ItemContent {
  content: unknown
  data: Record<string, unknown>
}

interface CatalogRow {
  id: string
  type: ItemType
  name: string
  teaser: string
  price: number
  preview: string | null
  owned: boolean
  equipped: boolean
}

const PURCHASE_RESULTS: readonly string[] = ['purchased', 'owned', 'insufficient', 'not_found']
const EQUIP_RESULTS: readonly string[] = ['ok', 'not_owned', 'invalid']

export async function fetchCatalog(): Promise<CatalogItem[]> {
  const { data, error } = await supabase.rpc('library_catalog')
  if (error) throw error
  return ((data ?? []) as CatalogRow[]).map((row) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    teaser: row.teaser,
    price: Number(row.price),
    preview: row.preview,
    owned: row.owned,
    equipped: row.equipped,
  }))
}

export async function purchaseItem(id: string): Promise<PurchaseResult> {
  const { data, error } = await supabase.rpc('purchase_item', { p_item_id: id })
  if (error || typeof data !== 'string' || !PURCHASE_RESULTS.includes(data)) return 'error'
  return data as PurchaseResult
}

export async function fetchItemContent(id: string): Promise<ItemContent | null> {
  const { data, error } = await supabase.rpc('get_item_content', { p_item_id: id })
  if (error) throw error
  const row = ((data ?? []) as { content: unknown; data: Record<string, unknown> | null }[])[0]
  return row ? { content: row.content, data: row.data ?? {} } : null
}

export async function saveQuizResult(id: string, score: number): Promise<number | null> {
  const { data, error } = await supabase.rpc('save_quiz_result', { p_item_id: id, p_score: score })
  if (error || typeof data !== 'number') return null
  return data
}

export async function setEquipped(type: 'pin_skin' | 'title', id: string | null): Promise<EquipResult> {
  const { data, error } = await supabase.rpc('set_equipped', { p_type: type, p_item_id: id })
  if (error || typeof data !== 'string' || !EQUIP_RESULTS.includes(data)) return 'error'
  return data as EquipResult
}
