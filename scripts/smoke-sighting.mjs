// Test dymny funkcji zgłoszeń na lokalnym Supabase z VERIFIER=fake i FAKE_RAT_COUNT=1.
// Wymaga: npm run db:start, a w drugim terminalu: npm run functions:serve. Uruchom: npm run smoke
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import jpeg from 'jpeg-js'

const status = execSync('npx supabase status -o env', { stdio: ['ignore', 'pipe', 'ignore'] }).toString()
const env = Object.fromEntries(
  status
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => {
      const at = line.indexOf('=')
      return [line.slice(0, at), line.slice(at + 1).replace(/^"|"$/g, '')]
    }),
)

const url = 'http://127.0.0.1:54321'
const admin = createClient(url, env.SECRET_KEY)
const email = `smoke${Date.now()}@example.com`
const password = 'Smoke-123456'
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
if (created.error) throw created.error

const client = createClient(url, env.PUBLISHABLE_KEY)
const signIn = await client.auth.signInWithPassword({ email, password })
if (signIn.error) throw signIn.error

function noiseJpeg(seed) {
  const width = 320
  const height = 240
  const data = new Uint8Array(width * height * 4)
  let state = seed
  for (let i = 0; i < data.length; i += 4) {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    data[i] = state % 256
    data[i + 1] = (state >> 8) % 256
    data[i + 2] = (state >> 16) % 256
    data[i + 3] = 255
  }
  return jpeg.encode({ data, width, height }, 85).data
}

async function send(photo, lat, lon) {
  const form = new FormData()
  form.append('photo', new Blob([photo], { type: 'image/jpeg' }), 'photo.jpg')
  form.append('lat', String(lat))
  form.append('lon', String(lon))
  form.append('accuracy', '10')
  form.append('capturedAt', new Date().toISOString())
  const { data, error } = await client.functions.invoke('submit-sighting', { body: form })
  if (error) throw new Error(`${error.name}: ${await error.context?.text?.()}`)
  return data
}

function check(label, actual, predicate) {
  const ok = predicate(actual)
  console.log(`${ok ? '✓' : '✗'} ${label}: ${JSON.stringify(actual)}`)
  if (!ok) process.exitCode = 1
}

// Ziarno zależne od czasu: kolejne uruchomienia nie trafiają na „duplikat” z poprzednich.
const seed = Date.now() % 1_000_000
const first = noiseJpeg(seed + 1)
check('zaliczony szczur na Rynku', await send(first, 51.11, 17.032),
  (d) => d.status === 'accepted' && d.rats_awarded === 1 && d.tokens_awarded === 10 && d.public_on_map === true)
check('ten sam szczur 7 m dalej', await send(noiseJpeg(seed + 2), 51.11, 17.0321), (d) => d.status === 'accepted_no_points')
check('to samo zdjęcie drugi raz', await send(first, 51.12, 17.05), (d) => d.status === 'blocked' && d.reason === 'duplicate')
check('Warszawa', await send(noiseJpeg(seed + 3), 52.2297, 21.0122), (d) => d.status === 'blocked' && d.reason === 'outside_city')

const retry = await client.functions.invoke('retry-pending', { body: {} })
check('brak zaległych zgłoszeń', retry.data, (d) => d?.resolved === 0)

const profile = await client.from('profiles').select('total_rats, tokens_balance').single()
check('profil po zgłoszeniach', profile.data, (p) => p.total_rats === 1 && p.tokens_balance === 10)

const publicPhoto = await admin.storage.from('map-photos').list()
check('zdjęcie w publicznym buckecie', publicPhoto.data?.length, (n) => n >= 1)
