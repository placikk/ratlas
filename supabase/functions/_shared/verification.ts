// Wspólny kod Edge Functions — bez API Deno, żeby dało się go testować Vitestem.
import { z } from 'zod'

export const ALLOWED_TAGS = ['smietnik', 'krasnal', 'woda', 'tramwaj_przystanek', 'deszcz'] as const

export type AllowedTag = (typeof ALLOWED_TAGS)[number]

export interface VerificationResult {
  ratCount: number
  isSelfie: boolean
  isScreenOrPrint: boolean
  isToyOrDrawing: boolean
  hasThirdPartyFaces: boolean
  tags: AllowedTag[]
  raw: unknown
}

export interface RatVerifier {
  readonly name: string
  verify(jpeg: Uint8Array): Promise<VerificationResult>
}

// Model chwilowo niedostępny (limit, timeout, błąd serwera) — zgłoszenie czeka jako „pending”.
export class VerifierUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VerifierUnavailableError'
  }
}

const schema = z.object({
  ratCount: z.number().int().min(0).max(100),
  isSelfie: z.boolean(),
  isScreenOrPrint: z.boolean(),
  isToyOrDrawing: z.boolean(),
  hasThirdPartyFaces: z.boolean(),
  tags: z.array(z.string()),
})

function isAllowedTag(tag: string): tag is AllowedTag {
  return (ALLOWED_TAGS as readonly string[]).includes(tag)
}

export function parseVerification(json: unknown): VerificationResult {
  const parsed = schema.parse(json)
  return { ...parsed, tags: parsed.tags.filter(isAllowedTag), raw: json }
}

export function isPublicCandidate(verification: VerificationResult | null): boolean {
  return (
    verification !== null &&
    verification.ratCount > 0 &&
    !verification.isScreenOrPrint &&
    !verification.isToyOrDrawing &&
    !verification.isSelfie &&
    !verification.hasThirdPartyFaces
  )
}
