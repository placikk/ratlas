export interface Pin {
  id: string
  lon: number
  lat: number
  rats: number
  createdAt: string
  photoPath: string
  nickname: string | null
  isMine: boolean
}

export interface Bounds {
  west: number
  south: number
  east: number
  north: number
}

export interface PinProperties {
  id: string
  rats: number
  opacity: number
  mine: boolean
}

export interface PinFeature {
  type: 'Feature'
  id: number
  properties: PinProperties
  geometry: { type: 'Point'; coordinates: [number, number] }
}

export interface PinCollection {
  type: 'FeatureCollection'
  features: PinFeature[]
}

export const DEFAULT_FADE_DAYS = 7
export const MIN_PIN_OPACITY = 0.15

const DAY_MS = 86_400_000

// Świeża pinezka jest w pełni widoczna, a z wiekiem blednie aż do MIN_PIN_OPACITY.
export function pinOpacity(createdAt: string, now: number, fadeDays: number): number {
  const ageDays = (now - Date.parse(createdAt)) / DAY_MS
  return Math.max(MIN_PIN_OPACITY, Math.min(1, 1 - ageDays / fadeDays))
}

export function toFeatureCollection(pins: Pin[], now: number, fadeDays: number): PinCollection {
  return {
    type: 'FeatureCollection',
    features: pins.map((pin, index) => ({
      type: 'Feature',
      id: index,
      properties: { id: pin.id, rats: pin.rats, opacity: pinOpacity(pin.createdAt, now, fadeDays), mine: pin.isMine },
      geometry: { type: 'Point', coordinates: [pin.lon, pin.lat] },
    })),
  }
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', DAY_MS],
  ['hour', 3_600_000],
  ['minute', 60_000],
]

export function timeAgo(createdAt: string, now: number, justNow: string): string {
  const diff = Date.parse(createdAt) - now
  const format = new Intl.RelativeTimeFormat('pl', { numeric: 'auto' })
  for (const [unit, size] of UNITS) {
    if (Math.abs(diff) >= size) return format.format(Math.round(diff / size), unit)
  }
  return justNow
}
