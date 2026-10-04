import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchFadeDays, fetchPins } from './mapApi'
import { MapView, type MapLabels } from './MapView'
import { DEFAULT_FADE_DAYS, toFeatureCollection, type Bounds, type Pin } from './pins'
import { PinPanel } from './PinPanel'

export const MAP_REFRESH_MS = 60_000

export function MapScreen() {
  const { t } = useTranslation()
  const [pins, setPins] = useState<Pin[]>([])
  const [fadeDays, setFadeDays] = useState(DEFAULT_FADE_DAYS)
  const [now, setNow] = useState(() => Date.now())
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState<Pin | null>(null)
  const boundsRef = useRef<Bounds | null>(null)
  const requestRef = useRef(0)

  // Odpowiedź spóźnionego zapytania (np. po szybkim przesuwaniu mapy) jest pomijana.
  const load = useCallback(async (bounds: Bounds) => {
    boundsRef.current = bounds
    const request = ++requestRef.current
    try {
      const loaded = await fetchPins(bounds)
      if (request !== requestRef.current) return
      setPins(loaded)
      setFailed(false)
    } catch {
      if (request === requestRef.current) setFailed(true)
    }
    setNow(Date.now())
  }, [])

  useEffect(() => {
    let active = true
    void fetchFadeDays().then((days) => {
      if (active) setFadeDays(days)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden) return
      if (boundsRef.current) void load(boundsRef.current)
    }, MAP_REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  const collection = useMemo(() => toFeatureCollection(pins, now, fadeDays), [pins, now, fadeDays])

  const labels: MapLabels = {
    zoomIn: t('map.zoomIn'),
    zoomOut: t('map.zoomOut'),
    locate: t('map.locate'),
    locationUnavailable: t('map.locationUnavailable'),
    attribution: t('map.attribution'),
    mapTitle: t('map.mapTitle'),
  }

  return (
    <section className="map-screen">
      <MapView collection={collection} labels={labels} onSelect={(id) => setSelected(pins.find((pin) => pin.id === id) ?? null)} onBoundsChange={(bounds) => void load(bounds)} />
      {failed && (
        <p className="map-screen__error" role="alert">
          {t('map.loadFailed')}
        </p>
      )}
      {selected && (
        <PinPanel
          key={selected.id}
          pin={selected}
          now={now}
          onClose={() => setSelected(null)}
          onHidden={(id) => setPins((current) => current.filter((pin) => pin.id !== id))}
        />
      )}
    </section>
  )
}
