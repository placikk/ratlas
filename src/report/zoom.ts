export interface ZoomRange {
  min: number
  max: number
}

export const MAX_ZOOM = 5
export const DIGITAL_ZOOM: ZoomRange = { min: 1, max: MAX_ZOOM }
export const ZOOM_PRESETS = [1, 2, 3]

export function clampZoom(value: number, range: ZoomRange): number {
  return Math.round(Math.min(range.max, Math.max(range.min, value)) * 10) / 10
}

// Przybliżenie rośnie proporcjonalnie do rozsunięcia palców.
export function pinchZoom(startZoom: number, startDistance: number, currentDistance: number, range: ZoomRange): number {
  return clampZoom(startZoom * (currentDistance / startDistance), range)
}

// Fragment klatki widoczny przy cyfrowym przybliżeniu (środek o boku 1/zoom).
export function centerCrop(width: number, height: number, zoom: number): { sx: number; sy: number; sw: number; sh: number } {
  const sw = Math.round(width / zoom)
  const sh = Math.round(height / zoom)
  return { sx: Math.round((width - sw) / 2), sy: Math.round((height - sh) / 2), sw, sh }
}

interface ZoomCapabilities {
  zoom?: { min: number; max: number }
}

// Zakres przybliżenia samego aparatu (zwykle Android + Chrome); null, gdy aparat go nie udostępnia.
export function hardwareZoomRange(track: MediaStreamTrack): ZoomRange | null {
  const zoom = (track.getCapabilities?.() as ZoomCapabilities | undefined)?.zoom
  if (!zoom) return null
  const range = { min: Math.max(1, zoom.min), max: Math.min(MAX_ZOOM, zoom.max) }
  return range.max > range.min ? range : null
}
