import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { capturePhoto } from './photo'

export type Facing = 'environment' | 'user'

function stopTracks(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop())
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
  const [ready, setReady] = useState(false)

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

  async function shoot() {
    const video = videoRef.current
    if (!video) return
    try {
      onShot(await capturePhoto(video))
    } catch {
      // Klatka chwilowo niedostępna (np. aparat jeszcze się uruchamia) — użytkownik może nacisnąć ponownie.
    }
  }

  return (
    <div className="camera">
      <video ref={videoRef} className="camera__video" autoPlay playsInline muted />
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
