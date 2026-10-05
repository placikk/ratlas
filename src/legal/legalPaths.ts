import type { LegalDoc } from './LegalModal'

const PATHS: Record<string, LegalDoc> = {
  '/prywatnosc': 'privacy',
  '/regulamin': 'terms',
}

// Publiczne adresy dokumentów (np. dla ekranu zgody Google) — działają bez logowania.
export function legalDocForPath(pathname: string): LegalDoc | null {
  return PATHS[pathname.replace(/\/+$/, '')] ?? null
}
