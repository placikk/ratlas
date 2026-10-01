import { useEffect, useRef, useState, type TouchEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { capturePhoto } from './photo'
import { clampZoom, DIGITAL_ZOOM, hardwareZoomRange, pinchZoom, ZOOM_PRESETS, type ZoomRange } from './zoom'

export type Facing = 'environment' | 'user'

function stopTracks(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop())
}

function touchDistance(event: TouchEvent): number {
  const [a, b] = [event.touches[0], event.touches[1]]
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

interface Zoom {
  // `hardware` — przybliża sam aparat; `digital` — powiększamy podgląd i wycinamy środek zdjęcia.
  mode: 'hardware' | 'digital'
  range: ZoomRange
  value: number
}

// Rodzic zmienia `key` przy przełączeniu aparatu, więc każdy montaż obsługuje jeden strumień.
export function CameraView({
  facing,
  onShot,
  onDenied,
}: {
  facing: Facing
  onShot: (photo: Blob) => void
  onDenied: () => void
}) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null)
  const [ready, setReady] = useState(false)
  const [zoom, setZoomState] = useState<Zoom>({ mode: 'digital', range: DIGITAL_ZOOM, value: 1 })

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null

    if (!navigator.mediaDevices?.getUserMedia) {
      onDenied()
      return
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 } }, audio: false }).then(
      (started) => {
        if (cancelled) {
          stopTracks(started)
          return
        }
        stream = started
        const track = started.getVideoTracks?.()[0] ?? started.getTracks()[0] ?? null
        trackRef.current = track
        const hardware = track ? hardwareZoomRange(track) : null
        setZoomState(hardware ? { mode: 'hardware', range: hardware, value: hardware.min } : { mode: 'digital', range: DIGITAL_ZOOM, value: 1 })
        if (videoRef.current) videoRef.current.srcObject = started
        setReady(true)
      },
      () => {
        if (!cancelled) onDenied()
      },
    )

    return () => {
      cancelled = true
      if (stream) stopTracks(stream)
    }
  }, [facing, onDenied])

  function setZoom(requested: number) {
    const value = clampZoom(requested, zoom.range)
    setZoomState({ ...zoom, value })
    if (zoom.mode === 'hardware') {
      // Nieobsłużone ograniczenie nie jest błędem krytycznym — podgląd po prostu się nie zmieni.
      // `zoom` jest w specyfikacji Image Capture, ale jeszcze nie w typach TypeScriptu.
      const constraints = { advanced: [{ zoom: value }] } as unknown as MediaTrackConstraints
      trackRef.current?.applyConstraints(constraints).catch(() => undefined)
    }
  }

  function onTouchStart(event: TouchEvent) {
    if (event.touches.length === 2) pinchRef.current = { distance: touchDistance(event), zoom: zoom.value }
  }

  function onTouchMove(event: TouchEvent) {
    const start = pinchRef.current
    if (!start || event.touches.length !== 2) return
    setZoom(pinchZoom(start.zoom, start.distance, touchDistance(event), zoom.range))
  }

  function onTouchEnd(event: TouchEvent) {
    if (event.touches.length < 2) pinchRef.current = null
  }

  async function shoot() {
    const video = videoRef.current
    if (!video) return
    try {
      onShot(await capturePhoto(video, zoom.mode === 'digital' ? zoom.value : 1))
    } catch {
      // Klatka chwilowo niedostępna (np. aparat jeszcze się uruchamia) — użytkownik może nacisnąć ponownie.
    }
  }

  const presets = ZOOM_PRESETS.filter((preset) => preset >= zoom.range.min && preset <= zoom.range.max)

  return (
    <div className="camera" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <video
        ref={videoRef}
        className="camera__video"
        style={zoom.mode === 'digital' && zoom.value > 1 ? { transform: `scale(${zoom.value})` } : undefined}
        autoPlay
        playsInline
        muted
      />
      <div className="camera__zoom">
        <span className="camera__zoom-level">{t('report.zoomLevel', { value: zoom.value.toFixed(1) })}</span>
        <div className="camera__zoom-presets">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-label={t('report.zoomTo', { value: preset })}
              aria-pressed={zoom.value === preset}
              onClick={() => setZoom(preset)}
            >
              {preset}×
            </button>
          ))}
        </div>
      </div>
      <button
        className="camera__shutter"
        type="button"
        aria-label={t('report.shoot')}
        disabled={!ready}
        onClick={() => void shoot()}
      />
    </div>
  )
}
