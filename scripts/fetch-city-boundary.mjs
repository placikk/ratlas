// Pobiera obrys administracyjny Wrocławia z OpenStreetMap (Nominatim) i zapisuje migrację SQL.
// Dane: © OpenStreetMap contributors, licencja ODbL. Uruchom: node scripts/fetch-city-boundary.mjs
import { writeFileSync } from 'node:fs'

const WROCLAW_RELATION_ID = 451516
const url =
  'https://nominatim.openstreetmap.org/search?q=Wroc%C5%82aw&countrycodes=pl&format=json' +
  '&polygon_geojson=1&polygon_threshold=0.0003&limit=1&featureType=city'

const response = await fetch(url, {
  headers: { 'User-Agent': 'ratlas-dev/0.1 (+https://github.com/placikk/ratlas)' },
})
if (!response.ok) throw new Error(`Nominatim: HTTP ${response.status}`)

const [place] = await response.json()
if (!place || place.osm_id !== WROCLAW_RELATION_ID || !['Polygon', 'MultiPolygon'].includes(place.geojson?.type)) {
  throw new Error('Nieoczekiwana odpowiedź Nominatim — sprawdź ręcznie')
}

const geojson = JSON.stringify(place.geojson)
const sql = `-- Obrys administracyjny Wrocławia (OSM relation ${WROCLAW_RELATION_ID}), wygenerowany przez scripts/fetch-city-boundary.mjs.
-- Dane: © OpenStreetMap contributors, licencja ODbL (https://www.openstreetmap.org/copyright).
insert into public.city_boundary (id, name, geom)
values (1, 'Wrocław', extensions.st_multi(extensions.st_geomfromgeojson('${geojson}'))::extensions.geography);
`

writeFileSync('supabase/migrations/20261001000100_city_boundary.sql', sql)
console.log(`Zapisano obrys Wrocławia (${geojson.length} znaków GeoJSON)`)
