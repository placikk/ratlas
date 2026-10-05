import 'maplibre-gl/dist/maplibre-gl.css'
import {
  GeolocateControl,
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useRef } from 'react'
import { BASE_STYLE_URL, ratifyStyle } from './mapStyle'
import { normalizeBounds, type Bounds, type PinCollection } from './pins'
import { PIN_SKINS, ratIconSvg, svgToImage } from './ratIcons'

// MapLibre 6 to ESM z osobnym workerem — Vite pakuje go razem z zależnościami.
setWorkerUrl(workerUrl)

export interface MapLabels {
  zoomIn: string
  zoomOut: string
  locate: string
  locationUnavailable: string
  attribution: string
  mapTitle: string
}

const WROCLAW_CENTER: [number, number] = [17.032, 51.11]

// Mapa odmontowuje się przy zmianie karty — pamiętamy ostatni widok.
let lastCamera: { center: [number, number]; zoom: number } | null = null

const SOURCE_ID = 'pins'

async function loadStyle(): Promise<StyleSpecification | string> {
  try {
    const response = await fetch(BASE_STYLE_URL)
    if (!response.ok) return BASE_STYLE_URL
    return ratifyStyle((await response.json()) as StyleSpecification)
  } catch {
    // Bez przekolorowania mapa i tak działa.
    return BASE_STYLE_URL
  }
}

function boundsOf(map: MapLibreMap): Bounds {
  const bounds = map.getBounds()
  return normalizeBounds({ west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() })
}

export function MapView({
  collection,
  labels,
  onSelect,
  onBoundsChange,
}: {
  collection: PinCollection
  labels: MapLabels
  onSelect: (id: string) => void
  onBoundsChange: (bounds: Bounds) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const readyRef = useRef(false)
  const collectionRef = useRef(collection)
  const callbacksRef = useRef({ onSelect, onBoundsChange })
  const labelsRef = useRef(labels)

  // Odświeża ref-y po każdym renderze (przed pozostałymi efektami).
  useEffect(() => {
    callbacksRef.current = { onSelect, onBoundsChange }
    collectionRef.current = collection
  })

  useEffect(() => {
    let cancelled = false
    let created: MapLibreMap | null = null

    void loadStyle().then((style) => {
      if (cancelled || !containerRef.current) return
      const l = labelsRef.current
      const map = new MapLibreMap({
        container: containerRef.current,
        style,
        center: lastCamera?.center ?? WROCLAW_CENTER,
        zoom: lastCamera?.zoom ?? 13,
        attributionControl: { compact: true },
        locale: {
          'NavigationControl.ZoomIn': l.zoomIn,
          'NavigationControl.ZoomOut': l.zoomOut,
          'GeolocateControl.FindMyLocation': l.locate,
          'GeolocateControl.LocationNotAvailable': l.locationUnavailable,
          'AttributionControl.ToggleAttribution': l.attribution,
          'Map.Title': l.mapTitle,
        },
      })
      created = map
      mapRef.current = map
      map.addControl(new NavigationControl({ showCompass: false }))
      map.addControl(new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }))

      map.on('load', async () => {
        try {
          // Każda skórka w dwóch wersjach: zwykła i „moja” (z jasnym okręgiem).
          const icons = await Promise.all(
            Object.keys(PIN_SKINS).flatMap((skin) =>
              [false, true].map(async (mine) => ({
                name: `rat-${skin}${mine ? '-mine' : ''}`,
                image: await svgToImage(ratIconSvg(skin, mine), 96),
              })),
            ),
          )
          if (cancelled) return
          for (const icon of icons) map.addImage(icon.name, icon.image, { pixelRatio: 2 })
        } catch (error) {
          if (cancelled) return
          console.error('Nie udało się wczytać ikon pinezek', error)
        }
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: collectionRef.current as unknown as Parameters<GeoJSONSource['setData']>[0],
          cluster: true,
          clusterRadius: 44,
          clusterMaxZoom: 15,
          clusterProperties: { rats: ['+', ['get', 'rats']] },
        })
        // Gniazda: przy oddaleniu bliskie pinezki łączą się w „norę” z sumą szczurów.
        map.addLayer({
          id: 'nests',
          type: 'circle',
          source: SOURCE_ID,
          filter: ['has', 'point_count'],
          paint: { 'circle-color': '#3A3839', 'circle-radius': 20, 'circle-stroke-color': '#C98A8F', 'circle-stroke-width': 3 },
        })
        map.addLayer({
          id: 'nest-count',
          type: 'symbol',
          source: SOURCE_ID,
          filter: ['has', 'point_count'],
          layout: { 'text-field': ['to-string', ['get', 'rats']], 'text-font': ['Noto Sans Bold'], 'text-size': 15 },
          paint: { 'text-color': '#EBD3D3' },
        })
        map.addLayer({
          id: 'rats',
          type: 'symbol',
          source: SOURCE_ID,
          filter: ['!', ['has', 'point_count']],
          layout: {
            'icon-image': ['concat', 'rat-', ['get', 'skin'], ['case', ['get', 'mine'], '-mine', '']],
            'icon-allow-overlap': true,
            'text-field': ['case', ['>', ['get', 'rats'], 1], ['to-string', ['get', 'rats']], ''],
            'text-font': ['Noto Sans Bold'],
            'text-size': 13,
            'text-offset': [1.4, -1.4],
            'text-allow-overlap': true,
          },
          paint: {
            'icon-opacity': ['get', 'opacity'],
            'text-opacity': ['get', 'opacity'],
            'text-color': '#3A3839',
            'text-halo-color': '#FFFFFF',
            'text-halo-width': 2,
          },
        })

        map.on('click', 'rats', (event: MapLayerMouseEvent) => {
          const id = event.features?.[0]?.properties?.id
          if (typeof id === 'string') callbacksRef.current.onSelect(id)
        })
        map.on('click', 'nests', async (event: MapLayerMouseEvent) => {
          const feature = event.features?.[0]
          const clusterId = feature?.properties?.cluster_id
          if (feature?.geometry.type !== 'Point' || typeof clusterId !== 'number') return
          const source = map.getSource(SOURCE_ID) as GeoJSONSource
          const zoom = await source.getClusterExpansionZoom(clusterId)
          map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom })
        })
        for (const layer of ['rats', 'nests']) {
          map.on('mouseenter', layer, () => {
            map.getCanvas().style.cursor = 'pointer'
          })
          map.on('mouseleave', layer, () => {
            map.getCanvas().style.cursor = ''
          })
        }

        readyRef.current = true
        map.on('moveend', () => {
          lastCamera = { center: map.getCenter().toArray() as [number, number], zoom: map.getZoom() }
          callbacksRef.current.onBoundsChange(boundsOf(map))
        })
        callbacksRef.current.onBoundsChange(boundsOf(map))
      })
    })

    return () => {
      cancelled = true
      readyRef.current = false
      created?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    void (map.getSource(SOURCE_ID) as GeoJSONSource | undefined)?.setData(collection as unknown as Parameters<GeoJSONSource['setData']>[0])
  }, [collection])

  return <div ref={containerRef} className="map-view" />
}
