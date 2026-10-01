import { centerCrop } from './zoom'

export const MAX_PHOTO_EDGE = 1600
export const JPEG_QUALITY = 0.82

export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

// Klatka z podglądu aparatu → JPEG. Rysowanie przez canvas nie przenosi EXIF (m.in. GPS z aparatu).
// `digitalZoom` > 1 wycina środek kadru — tak jak widać go w powiększonym podglądzie.
export function capturePhoto(video: HTMLVideoElement, digitalZoom = 1): Promise<Blob> {
  const crop = centerCrop(video.videoWidth, video.videoHeight, digitalZoom)
  const size = fitWithin(crop.sw, crop.sh, MAX_PHOTO_EDGE)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('Brak kontekstu 2D'))
  context.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, size.width, size.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Nie udało się zapisać zdjęcia'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}
