# Plan 2: Zgłoszenia szczurów — implementacja

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Użytkownik Ratlasa robi zdjęcie szczura aparatem w aplikacji, serwer sprawdza je (Wrocław, limit, duplikat, Gemini, cooldown) i nalicza szczury oraz raciki; profil pokazuje rangę z postępem.

**Architecture:** Cała logika punktów żyje w funkcjach SQL (`security definer`, wykonywalne tylko przez `service_role`), wołanych z Edge Function `submit-sighting` (Deno, `@supabase/server` z `auth: 'user'`). Rozpoznawanie szczura to wymienny `RatVerifier` (Gemini przez REST `generateContent`, albo `fake` lokalnie). Kod dzielony przez funkcje (`supabase/functions/_shared/*.ts`) nie używa API Deno, więc testujemy go Vitestem. Frontend: ekran aparatu (`getUserMedia`), dokładny GPS (`watchPosition`), wysyłka przez `supabase.functions.invoke`.

**Tech Stack:** jak w planie 1 + PostGIS 3.3 (schemat `extensions`), Supabase Edge Functions (edge-runtime ≈ Deno 2.1), `npm:@supabase/server@^1`, `npm:jpeg-js@^0.4.4`, `npm:zod@^4`, Gemini API (`v1beta/models/{model}:generateContent`).

**Spec:** [docs/superpowers/specs/2026-09-29-szczury-wroclaw-design.md](../specs/2026-09-29-szczury-wroclaw-design.md) (sekcje 3, 4, 5, 6 — rangi, 10, 11)

**Poprzedni plan:** [2026-09-30-plan-1-fundament.md](2026-09-30-plan-1-fundament.md) — zrealizowany; kod w repozytorium jest źródłem prawdy o istniejących modułach.

## Odstępstwa od specyfikacji (decyzje planu 2)

1. **Ponawianie weryfikacji `pending`** uruchamia aplikacja (wywołanie `retry-pending` przy każdym starcie), a nie `pg_cron`. Powód: `pg_cron` + `pg_net` wymagałyby trzymania tajnego klucza w Vault i osobnej konfiguracji sieci lokalnie i w chmurze. Koszt: zaległe zgłoszenie rozstrzyga się dopiero przy następnym otwarciu aplikacji przez autora.
2. **Kolejka offline w IndexedDB (24 h) — odłożona.** Przy braku zasięgu zdjęcie zostaje w pamięci ekranu, a użytkownik ma przycisk „Spróbuj ponownie”.
3. **Automatyczne kasowanie odrzuconych zdjęć po 30 dniach — odłożone do planu 4.**
4. **Dokładność GPS sprawdza też serwer** (`gps_max_accuracy_m`), nie tylko telefon.

## Global Constraints

- Nazwa aplikacji: **Ratlas**. Waluta w interfejsie: **raciki** (1 racik, 2 raciki, 5 racików); w kodzie i bazie nazwy `tokens*` bez zmian.
- Język interfejsu: polski; każdy widoczny tekst z `src/i18n/pl.json` (przez `useTranslation`, liczba mnoga przez klucze `_one/_few/_many/_other`).
- Koszt: tylko darmowe plany; bez usług wymagających karty.
- **Produkcyjna baza ma wyłączone „Automatically expose new tables”** — każda nowa tabela i funkcja w migracji dostaje jawne `revoke`/`grant`, a pgTAP sprawdza uprawnienia. Lokalnie udostępnianie jest włączone, więc brak `grant` wyjdzie dopiero na produkcji.
- **Nie ufamy telefonowi:** punkty, raciki i statusy zmieniają wyłącznie funkcje SQL wykonywalne tylko przez `service_role`; użytkownik (`authenticated`) nie ma prawa zapisu do `sightings`, `token_ledger`, `profiles.total_rats/tokens_balance`.
- Wartości domyślne `app_config`: `daily_submission_limit` 10, `cooldown_radius_m` 50, `cooldown_minutes` 30, `max_rats_per_photo` 5, `tokens_per_rat` 10, `pin_fade_days` 7, `map_location_precision` `"exact"`, `duplicate_hamming_threshold` 6, `duplicate_window_days` 30, `reports_to_hide` 3, `max_verify_attempts` 5, `gps_max_accuracy_m` 100.
- Rangi: 0 Szczurzy Nowicjusz, 5 Podwórkowy Obserwator, 15 Tropiciel z Nadodrza, 40 Kanałowy Zwiadowca, 100 Łowca z Rynku, 250 Szczurołap, 500 Król Szczurów Wrocławia.
- Zamknięta lista tagów: `smietnik`, `krasnal`, `woda`, `tramwaj_przystanek`, `deszcz`.
- Zdjęcie: JPEG, dłuższy bok ≤ 1600 px, jakość 0.82, bez EXIF (przez canvas), maks. 3 MB.
- Buckety Storage: `map-photos` (publiczny: zaakceptowane, bez selfie i bez twarzy osób trzecich), `sightings-private` (reszta; ścieżka `<user_id>/<sighting_id>.jpg`).
- Gemini: klucz tylko w sekretach (`GEMINI_API_KEY`), model `GEMINI_MODEL` (domyślnie `gemini-3.5-flash`), timeout 20 s; niedostępność modelu → status `pending`, nigdy utrata zgłoszenia. `VERIFIER=fake` wolno ustawić **tylko lokalnie**.
- Edge Functions: `withSupabase({ auth: 'user' })` z `@supabase/server`, w `config.toml` `verify_jwt = false` (JWT weryfikuje `withSupabase`).
- Lokalny Supabase: tylko `npm run db:start` / `db:stop` / `db:reset` / `test:db`; funkcje lokalnie: `npm run functions:serve`.
- TypeScript: `import type` dla typów, bez `enum`, bez parameter properties (`erasableSyntaxOnly`).
- Dane obrysu miasta: © OpenStreetMap contributors (ODbL) — komentarz w migracji.
- Commity: `git -c user.email=michalpla05@gmail.com -c user.name=placik commit …`, stopka `Co-Authored-By:` z nazwą modelu.

## Struktura plików (nowe i zmieniane)

```
scripts/fetch-city-boundary.mjs            # generuje migrację z obrysem Wrocławia (OSM/Nominatim)
scripts/smoke-sighting.mjs                 # test dymny funkcji na lokalnym Supabase (VERIFIER=fake)
scripts/eval-verifier.ts                   # ocena Gemini na własnych zdjęciach
scripts/eval/summary.ts (+ .test.ts)       # liczenie precyzji/czułości
eval/README.md, eval/labels.example.csv    # jak przygotować zbiór ewaluacyjny
supabase/migrations/20261001000000_config_ranks_city.sql
supabase/migrations/20261001000100_city_boundary.sql        # wygenerowany
supabase/migrations/20261001000200_sightings.sql
supabase/migrations/20261001000300_storage_buckets.sql
supabase/tests/config_ranks_city.test.sql
supabase/tests/sightings.test.sql
supabase/tests/storage.test.sql
supabase/functions/.env.example
supabase/functions/_shared/verification.ts (+ .test.ts)     # typy, walidacja wyniku, RatVerifier
supabase/functions/_shared/geminiVerifier.ts (+ .test.ts)   # Gemini REST
supabase/functions/_shared/selectVerifier.ts (+ .test.ts)   # gemini / fake
supabase/functions/_shared/imageHash.ts (+ .test.ts)        # dHash z JPEG
supabase/functions/_shared/pipeline.ts (+ .test.ts)         # formularz, miejsce zdjęcia
supabase/functions/submit-sighting/{index.ts,deno.json}
supabase/functions/retry-pending/{index.ts,deno.json}
src/report/photo.ts (+ .test.ts)            # zdjęcie z <video> → JPEG
src/report/location.ts (+ .test.ts)         # dokładny GPS
src/report/reportApi.ts (+ .test.ts)        # wywołania funkcji
src/report/CameraView.tsx                   # podgląd aparatu i spust
src/report/ReportScreen.tsx (+ .test.tsx)   # przepływ zgłoszenia
src/report/ResultView.tsx                   # ekran wyniku
src/report/report.css
src/profile/ranksApi.ts (+ .test.ts)        # rangi i postęp
src/profile/ProfileScreen.tsx, src/shell/AppShell.tsx, src/App.test.tsx, src/i18n/pl.json, vite.config.ts, package.json, .gitignore, docs/deploy.md, spec
```

---

### Task 1: Konfiguracja, rangi i obrys Wrocławia (baza)

**Files:**
- Create: `supabase/migrations/20261001000000_config_ranks_city.sql`, `scripts/fetch-city-boundary.mjs`, `supabase/migrations/20261001000100_city_boundary.sql` (wygenerowany), `supabase/tests/config_ranks_city.test.sql`

**Interfaces:**
- Consumes: istniejąca baza z planu 1 (`profiles`)
- Produces:
  - rozszerzenie `postgis` w schemacie `extensions` (typy `extensions.geography`, funkcje `extensions.st_*`)
  - tabela `public.app_config(key text pk, value jsonb, description text)` — odczyt dla `anon`, `authenticated`
  - funkcja wewnętrzna `public.config_int(p_key text) returns integer` (bez uprawnień dla ról API)
  - funkcja wewnętrzna `public.warsaw_day_start() returns timestamptz` (początek bieżącej doby w Europe/Warsaw)
  - tabela `public.city_boundary(id smallint pk = 1, name text, geom extensions.geography(MultiPolygon,4326))` — bez dostępu dla ról API
  - tabela `public.ranks(id smallint pk, name text, min_rats int unique)` — odczyt dla `anon`, `authenticated`

- [ ] **Step 1: Napisz testy bazy**

Utwórz `supabase/tests/config_ranks_city.test.sql`:

```sql
begin;
select plan(10);

select is(
  (select public.config_int('daily_submission_limit')),
  10,
  'domyślny dzienny limit to 10'
);

select is(
  (select count(*)::int from public.app_config),
  12,
  'konfiguracja ma 12 kluczy'
);

select is(
  (select array_agg(min_rats order by min_rats) from public.ranks),
  array[0, 5, 15, 40, 100, 250, 500],
  'progi rang zgodne ze specyfikacją'
);

select is(
  (select name from public.ranks where min_rats = 500),
  'Król Szczurów Wrocławia',
  'najwyższa ranga'
);

select ok(
  (select extensions.st_covers(geom, extensions.st_setsrid(extensions.st_makepoint(17.0320, 51.1100), 4326)::extensions.geography) from public.city_boundary),
  'Rynek leży we Wrocławiu'
);

select ok(
  not (select extensions.st_covers(geom, extensions.st_setsrid(extensions.st_makepoint(21.0122, 52.2297), 4326)::extensions.geography) from public.city_boundary),
  'Warszawa nie leży we Wrocławiu'
);

select ok(
  has_table_privilege('anon', 'public.app_config', 'select') and has_table_privilege('authenticated', 'public.ranks', 'select'),
  'konfigurację i rangi może czytać każdy'
);

select ok(
  not has_table_privilege('authenticated', 'public.app_config', 'update')
  and not has_table_privilege('authenticated', 'public.ranks', 'insert'),
  'użytkownik nie zmienia konfiguracji ani rang'
);

select ok(
  not has_table_privilege('authenticated', 'public.city_boundary', 'select'),
  'obrys miasta nie jest wystawiony przez API'
);

select ok(
  not has_function_privilege('authenticated', 'public.config_int(text)', 'execute')
  and not has_function_privilege('anon', 'public.warsaw_day_start()', 'execute'),
  'funkcje pomocnicze nie są wystawione przez API'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Uruchom testy i sprawdź, że nie przechodzą**

Run: `npm run test:db`
Expected: FAIL w `config_ranks_city.test.sql` — `function public.config_int(unknown) does not exist`.

- [ ] **Step 3: Migracja konfiguracji, rang i tabeli obrysu**

Utwórz `supabase/migrations/20261001000000_config_ranks_city.sql`:

```sql
-- Konfiguracja gry, rangi i obrys Wrocławia.
-- Produkcja ma wyłączone automatyczne udostępnianie tabel: uprawnienia nadajemy jawnie.
create extension if not exists postgis with schema extensions;

create table public.app_config (
  key text primary key,
  value jsonb not null,
  description text not null
);

alter table public.app_config enable row level security;

create policy "app_config: everyone can read"
  on public.app_config for select to anon, authenticated
  using (true);

revoke all on public.app_config from anon, authenticated;
grant select on public.app_config to anon, authenticated;

insert into public.app_config (key, value, description) values
  ('daily_submission_limit', '10', 'Maksymalna liczba zgłoszeń jednej osoby na dobę (czas polski)'),
  ('cooldown_radius_m', '50', 'Promień, w którym kolejne zgłoszenie tej samej osoby nie daje punktów'),
  ('cooldown_minutes', '30', 'Czas, przez który obowiązuje cooldown miejsca'),
  ('max_rats_per_photo', '5', 'Maksymalna liczba szczurów zaliczanych z jednego zdjęcia'),
  ('tokens_per_rat', '10', 'Raciki za jednego zaliczonego szczura'),
  ('pin_fade_days', '7', 'Po ilu dniach pinezka znika z mapy'),
  ('map_location_precision', '"exact"', 'Dokładność lokalizacji na mapie: exact albo fuzzy'),
  ('duplicate_hamming_threshold', '6', 'Maksymalna odległość Hamminga odcisków zdjęć uznawanych za duplikat'),
  ('duplicate_window_days', '30', 'Z ilu ostatnich dni porównujemy zdjęcia w poszukiwaniu duplikatów'),
  ('reports_to_hide', '3', 'Po ilu zgłoszeniach nadużycia pinezka się ukrywa'),
  ('max_verify_attempts', '5', 'Po ilu nieudanych próbach weryfikacji zgłoszenie jest odrzucane'),
  ('gps_max_accuracy_m', '100', 'Najgorsza akceptowana dokładność GPS w metrach');

create function public.config_int(p_key text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (value #>> '{}')::integer from public.app_config where key = p_key
$$;

create function public.warsaw_day_start()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select date_trunc('day', now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw'
$$;

revoke execute on function public.config_int(text) from public, anon, authenticated;
revoke execute on function public.warsaw_day_start() from public, anon, authenticated;

create table public.ranks (
  id smallint primary key,
  name text not null,
  min_rats integer not null unique check (min_rats >= 0)
);

alter table public.ranks enable row level security;

create policy "ranks: everyone can read"
  on public.ranks for select to anon, authenticated
  using (true);

revoke all on public.ranks from anon, authenticated;
grant select on public.ranks to anon, authenticated;

insert into public.ranks (id, name, min_rats) values
  (1, 'Szczurzy Nowicjusz', 0),
  (2, 'Podwórkowy Obserwator', 5),
  (3, 'Tropiciel z Nadodrza', 15),
  (4, 'Kanałowy Zwiadowca', 40),
  (5, 'Łowca z Rynku', 100),
  (6, 'Szczurołap', 250),
  (7, 'Król Szczurów Wrocławia', 500);

-- Obrys miasta: dane wstawia kolejna (wygenerowana) migracja.
create table public.city_boundary (
  id smallint primary key default 1 check (id = 1),
  name text not null,
  geom extensions.geography(MultiPolygon, 4326) not null
);

alter table public.city_boundary enable row level security;
revoke all on public.city_boundary from anon, authenticated;
```

- [ ] **Step 4: Generator obrysu Wrocławia**

Utwórz `scripts/fetch-city-boundary.mjs`:

```js
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
```

Run: `node scripts/fetch-city-boundary.mjs`
Expected: `Zapisano obrys Wrocławia (… znaków GeoJSON)` (ok. 10 000), plik `supabase/migrations/20261001000100_city_boundary.sql` istnieje.

- [ ] **Step 5: Zastosuj migracje i uruchom testy**

Run: `npm run db:reset && npm run test:db`
Expected: wszystkie pliki `ok`, `Result: PASS` (profiles 10, config_ranks_city 10).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations scripts/fetch-city-boundary.mjs supabase/tests/config_ranks_city.test.sql
git commit -m "feat: add game config, ranks and Wrocław boundary"
```

---

### Task 2: Zgłoszenia, dziennik racików i funkcje punktujące (baza)

**Files:**
- Create: `supabase/migrations/20261001000200_sightings.sql`, `supabase/tests/sightings.test.sql`

**Interfaces:**
- Consumes: `config_int`, `warsaw_day_start`, `city_boundary`, `profiles` (Task 1, plan 1)
- Produces (wszystkie funkcje `security definer`, `search_path = ''`):
  - tabela `public.sightings` (kolumny poniżej), `select` tylko własnych dla `authenticated`
  - tabela `public.token_ledger(id, user_id, delta, reason, ref_id, created_at)`, `select` tylko własnych
  - `public.precheck_sighting(p_user_id uuid, p_lon double precision, p_lat double precision, p_accuracy_m real, p_phash text) returns text` — `null` albo `'daily_limit' | 'gps_inaccurate' | 'outside_city' | 'duplicate'`
  - `public.record_sighting(p_id uuid, p_user_id uuid, p_lon double precision, p_lat double precision, p_accuracy_m real, p_captured_at timestamptz, p_photo_bucket text, p_photo_path text, p_phash text, p_verifier text, p_verification jsonb) returns jsonb` — `p_verification = null` zapisuje `pending`; wynik jak `sighting_result` albo `{"status":"blocked","reason":"daily_limit"}` (wtedy nic nie zapisano)
  - `public.resolve_pending(p_id uuid, p_photo_bucket text, p_photo_path text, p_verifier text, p_verification jsonb) returns jsonb`
  - `public.fail_verification(p_id uuid) returns jsonb`
  - `public.list_pending_sightings(p_user_id uuid) returns table(id uuid, photo_bucket text, photo_path text)` — maks. 5, najstarsze pierwsze
  - wynik (`sighting_result`): `{"id","status","reject_reason","rats_awarded","tokens_awarded","public_on_map","total_rats","tokens_balance"}`
  - `p_verification` ma kształt `VerificationResult` z Task 3: `{"ratCount":int,"isSelfie":bool,"isScreenOrPrint":bool,"isToyOrDrawing":bool,"hasThirdPartyFaces":bool,"tags":[text],"raw":any}`
  - `p_phash`: 16 znaków szesnastkowych (64 bity)
  - execute tylko dla `service_role`; funkcje wewnętrzne `apply_verification`, `sighting_result` bez uprawnień dla ról API

- [ ] **Step 1: Napisz testy bazy**

Utwórz `supabase/tests/sightings.test.sql`:

```sql
begin;
select plan(28);

insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'ala@example.com'),
       ('22222222-2222-2222-2222-222222222222', 'ola@example.com');

-- Rynek i plac Grunwaldzki (~1,7 km od siebie), Warszawa.
create temporary table v (name text primary key, value jsonb);
insert into v values
  ('three', '{"ratCount":3,"isSelfie":false,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":["smietnik"],"raw":{"m":1}}'),
  ('nine', '{"ratCount":9,"isSelfie":false,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":[],"raw":{}}'),
  ('none', '{"ratCount":0,"isSelfie":false,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":[],"raw":{}}'),
  ('screen', '{"ratCount":1,"isSelfie":false,"isScreenOrPrint":true,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":[],"raw":{}}'),
  ('selfie', '{"ratCount":1,"isSelfie":true,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":[],"raw":{}}');

-- 1–3: precheck
select is(
  public.precheck_sighting('11111111-1111-1111-1111-111111111111', 17.0320, 51.1100, 10, '0000000000000000'),
  null,
  'zgłoszenie z Rynku przechodzi wstępne kontrole'
);
select is(
  public.precheck_sighting('11111111-1111-1111-1111-111111111111', 21.0122, 52.2297, 10, '0000000000000000'),
  'outside_city',
  'Warszawa jest poza miastem'
);
select is(
  public.precheck_sighting('11111111-1111-1111-1111-111111111111', 17.0320, 51.1100, 150, '0000000000000000'),
  'gps_inaccurate',
  'zbyt niedokładny GPS jest odrzucany'
);

-- 4–8: zaliczony szczur
select is(
  public.record_sighting('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 17.0320, 51.1100, 10, now(),
    'map-photos', 'aaaaaaaa-0000-0000-0000-000000000001.jpg', '0000000000000000', 'fake', (select value from v where name = 'three')) ->> 'status',
  'accepted',
  'trzy szczury są zaliczone'
);
select is(
  (select row(rats_awarded, tokens_awarded, public_on_map, tags)::text from public.sightings where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  row(3, 30, true, array['smietnik'])::text,
  'zgłoszenie ma szczury, raciki, tagi i jest publiczne'
);
select is(
  (select row(total_rats, tokens_balance)::text from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  row(3, 30)::text,
  'profil dostał szczury i raciki'
);
select is(
  (select row(delta, reason)::text from public.token_ledger where ref_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  row(30, 'sighting')::text,
  'dziennik racików ma wpis'
);
select is(
  (select verifier_raw from public.sightings where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '{"m":1}'::jsonb,
  'surowa odpowiedź modelu jest zapisana'
);

-- 9–11: duplikaty
select is(
  public.precheck_sighting('22222222-2222-2222-2222-222222222222', 17.0400, 51.1150, 10, '0000000000000000'),
  'duplicate',
  'to samo zdjęcie (także od innej osoby) to duplikat'
);
select is(
  public.precheck_sighting('22222222-2222-2222-2222-222222222222', 17.0400, 51.1150, 10, '0000000000000003'),
  'duplicate',
  'zdjęcie różniące się o 2 bity to duplikat'
);
select is(
  public.precheck_sighting('22222222-2222-2222-2222-222222222222', 17.0400, 51.1150, 10, 'ffffffffffffffff'),
  null,
  'zupełnie inne zdjęcie nie jest duplikatem'
);

-- 12–13: cooldown
select is(
  public.record_sighting('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 17.0323, 51.1101, 10, now(),
    'map-photos', 'aaaaaaaa-0000-0000-0000-000000000002.jpg', 'ffffffffffffffff', 'fake', (select value from v where name = 'three')) ->> 'status',
  'accepted_no_points',
  'ten sam szczur 25 m dalej nie daje punktów'
);
select is(
  (select row(total_rats, tokens_balance)::text from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  row(3, 30)::text,
  'cooldown nie zmienia profilu'
);

-- 14: limit szczurów na zdjęcie (plac Grunwaldzki, poza promieniem cooldownu)
select is(
  (public.record_sighting('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 17.0590, 51.1110, 10, now(),
    'map-photos', 'aaaaaaaa-0000-0000-0000-000000000003.jpg', '00000000ffffffff', 'fake', (select value from v where name = 'nine')) ->> 'rats_awarded')::int,
  5,
  'z jednego zdjęcia zaliczamy najwyżej 5 szczurów'
);

-- 15–17: odrzucenia i selfie (użytkownik 2)
select is(
  public.record_sighting('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 17.0320, 51.1100, 10, now(),
    'sightings-private', '2222/b1.jpg', '0f0f0f0f0f0f0f0f', 'fake', (select value from v where name = 'none')) ->> 'reject_reason',
  'no_rat',
  'zdjęcie bez szczura jest odrzucone'
);
select is(
  public.record_sighting('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 17.0320, 51.1100, 10, now(),
    'sightings-private', '2222/b2.jpg', 'f0f0f0f0f0f0f0f0', 'fake', (select value from v where name = 'screen')) ->> 'reject_reason',
  'screen_or_print',
  'zdjęcie ekranu jest odrzucone'
);
select is(
  (select row(r ->> 'status', r ->> 'public_on_map')::text
     from (select public.record_sighting('bbbbbbbb-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 17.0320, 51.1100, 10, now(),
       'sightings-private', '2222/b3.jpg', '00ff00ff00ff00ff', 'fake', (select value from v where name = 'selfie')) as r) as x),
  row('accepted', 'false')::text,
  'selfie jest zaliczone, ale nie trafia na publiczną mapę'
);

-- 18–23: pending → resolve (idempotentnie)
select is(
  public.record_sighting('bbbbbbbb-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 17.0590, 51.1110, 10, now(),
    'sightings-private', '2222/b4.jpg', 'ff00ff00ff00ff00', 'gemini', null) ->> 'status',
  'pending',
  'bez odpowiedzi modelu zgłoszenie czeka'
);
select is(
  (select array_agg(id) from public.list_pending_sightings('22222222-2222-2222-2222-222222222222')),
  array['bbbbbbbb-0000-0000-0000-000000000004'::uuid],
  'lista zaległych zgłoszeń'
);
select is(
  public.resolve_pending('bbbbbbbb-0000-0000-0000-000000000004', 'map-photos', 'bbbbbbbb-0000-0000-0000-000000000004.jpg', 'gemini',
    (select value from v where name = 'three')) ->> 'tokens_awarded',
  '30',
  'rozstrzygnięte zgłoszenie daje raciki'
);
select is(
  (select row(total_rats, tokens_balance)::text from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  row(4, 40)::text,
  'selfie (1) + rozstrzygnięte (3) = 4 szczury, 40 racików'
);
select lives_ok(
  $$ select public.resolve_pending('bbbbbbbb-0000-0000-0000-000000000004', 'map-photos', 'x.jpg', 'gemini',
       '{"ratCount":3,"isSelfie":false,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":[],"raw":{}}') $$,
  'ponowne rozstrzygnięcie nic nie psuje'
);
select is(
  (select tokens_balance from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  40,
  'ponowne rozstrzygnięcie nie nalicza drugi raz'
);

-- 24: nieudane weryfikacje
do $$
begin
  perform public.record_sighting('bbbbbbbb-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 17.0590, 51.1110, 10, now(),
    'sightings-private', '2222/b5.jpg', '0123456789abcdef', 'gemini', null);
  perform public.fail_verification('bbbbbbbb-0000-0000-0000-000000000005') from generate_series(1, 5);
end;
$$;
select is(
  (select row(status, reject_reason)::text from public.sightings where id = 'bbbbbbbb-0000-0000-0000-000000000005'),
  row('rejected', 'verification_failed')::text,
  'po 5 nieudanych próbach zgłoszenie jest odrzucane'
);

-- 25–26: dzienny limit (użytkownik 2 ma już 5 zgłoszeń)
update public.app_config set value = '5' where key = 'daily_submission_limit';
select is(
  public.precheck_sighting('22222222-2222-2222-2222-222222222222', 17.0320, 51.1100, 10, 'fedcba9876543210'),
  'daily_limit',
  'po wyczerpaniu limitu precheck blokuje'
);
select is(
  public.record_sighting('bbbbbbbb-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 17.0320, 51.1100, 10, now(),
    'sightings-private', '2222/b6.jpg', 'fedcba9876543210', 'fake', (select value from v where name = 'three')),
  '{"status":"blocked","reason":"daily_limit"}'::jsonb,
  'zapis też pilnuje limitu (wyścig) i niczego nie zapisuje'
);

-- 27–28: uprawnienia
select ok(
  has_function_privilege('service_role', 'public.record_sighting(uuid,uuid,double precision,double precision,real,timestamptz,text,text,text,text,jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.record_sighting(uuid,uuid,double precision,double precision,real,timestamptz,text,text,text,text,jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.precheck_sighting(uuid,double precision,double precision,real,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.apply_verification(uuid,jsonb,text)', 'execute'),
  'punkty nalicza tylko serwer'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select is(
  (select count(*)::int from public.sightings) + (select count(*)::int from public.token_ledger) * 100,
  203,
  'użytkownik widzi tylko swoje 3 zgłoszenia i 2 wpisy dziennika (cooldown nie daje wpisu)'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Uruchom testy i sprawdź, że nie przechodzą**

Run: `npm run test:db`
Expected: FAIL w `sightings.test.sql` — `function public.precheck_sighting(...) does not exist`.

- [ ] **Step 3: Migracja**

Utwórz `supabase/migrations/20261001000200_sightings.sql`:

```sql
-- Zgłoszenia szczurów, dziennik racików i funkcje naliczające punkty.
-- Wszystko, co zmienia punkty, wykonuje tylko service_role (Edge Functions).

create table public.sightings (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'accepted_no_points', 'rejected')),
  reject_reason text check (reject_reason in ('no_rat', 'screen_or_print', 'toy_or_drawing', 'verification_failed')),
  location extensions.geography(Point, 4326) not null,
  location_accuracy_m real not null,
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  photo_bucket text not null,
  photo_path text not null,
  phash bit(64) not null,
  rats_detected integer,
  rats_awarded integer not null default 0,
  tokens_awarded integer not null default 0,
  is_selfie boolean not null default false,
  has_third_party_faces boolean not null default false,
  tags text[] not null default '{}',
  public_on_map boolean not null default false,
  hidden boolean not null default false,
  verifier text,
  verifier_raw jsonb,
  verify_attempts integer not null default 0
);

create index sightings_user_created_idx on public.sightings (user_id, created_at desc);
create index sightings_created_idx on public.sightings (created_at);
create index sightings_location_idx on public.sightings using gist (location);

alter table public.sightings enable row level security;

create policy "sightings: owner can read"
  on public.sightings for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.sightings from anon, authenticated;
grant select on public.sightings to authenticated;

create table public.token_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('sighting', 'achievement', 'purchase', 'correction')),
  ref_id uuid,
  created_at timestamptz not null default now()
);

create index token_ledger_user_idx on public.token_ledger (user_id, created_at desc);

alter table public.token_ledger enable row level security;

create policy "token_ledger: owner can read"
  on public.token_ledger for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.token_ledger from anon, authenticated;
grant select on public.token_ledger to authenticated;

create function public.precheck_sighting(
  p_user_id uuid,
  p_lon double precision,
  p_lat double precision,
  p_accuracy_m real,
  p_phash text
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_point extensions.geography :=
    extensions.st_setsrid(extensions.st_makepoint(p_lon, p_lat), 4326)::extensions.geography;
begin
  if (select count(*) from public.sightings
       where user_id = p_user_id and created_at >= public.warsaw_day_start())
     >= public.config_int('daily_submission_limit') then
    return 'daily_limit';
  end if;

  if p_accuracy_m > public.config_int('gps_max_accuracy_m') then
    return 'gps_inaccurate';
  end if;

  if not exists (select 1 from public.city_boundary where extensions.st_covers(geom, v_point)) then
    return 'outside_city';
  end if;

  if exists (
    select 1 from public.sightings
     where created_at > now() - make_interval(days => public.config_int('duplicate_window_days'))
       and bit_count(phash # ('x' || p_phash)::bit(64)) <= public.config_int('duplicate_hamming_threshold')
  ) then
    return 'duplicate';
  end if;

  return null;
end;
$$;

create function public.sighting_result(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'status', s.status,
    'reject_reason', s.reject_reason,
    'rats_awarded', s.rats_awarded,
    'tokens_awarded', s.tokens_awarded,
    'public_on_map', s.public_on_map,
    'total_rats', p.total_rats,
    'tokens_balance', p.tokens_balance
  )
  from public.sightings s
  join public.profiles p on p.id = s.user_id
  where s.id = p_id
$$;

create function public.apply_verification(p_id uuid, p_verification jsonb, p_verifier text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.sightings;
  v_detected integer := (p_verification ->> 'ratCount')::integer;
  v_rats integer;
  v_status text;
  v_reason text;
  v_tokens integer := 0;
  v_selfie boolean := coalesce((p_verification ->> 'isSelfie')::boolean, false);
  v_faces boolean := coalesce((p_verification ->> 'hasThirdPartyFaces')::boolean, false);
begin
  select * into s from public.sightings where id = p_id for update;
  -- Idempotentnie: rozstrzygamy tylko zgłoszenia, które wciąż czekają.
  if s.id is null or s.status <> 'pending' then
    return;
  end if;

  v_rats := least(greatest(v_detected, 0), public.config_int('max_rats_per_photo'));

  if v_detected <= 0 then
    v_status := 'rejected';
    v_reason := 'no_rat';
  elsif (p_verification ->> 'isScreenOrPrint')::boolean then
    v_status := 'rejected';
    v_reason := 'screen_or_print';
  elsif (p_verification ->> 'isToyOrDrawing')::boolean then
    v_status := 'rejected';
    v_reason := 'toy_or_drawing';
  elsif exists (
    select 1 from public.sightings o
     where o.user_id = s.user_id
       and o.id <> s.id
       and o.status = 'accepted'
       and o.created_at > s.created_at - make_interval(mins => public.config_int('cooldown_minutes'))
       and extensions.st_dwithin(o.location, s.location, public.config_int('cooldown_radius_m'))
  ) then
    v_status := 'accepted_no_points';
  else
    v_status := 'accepted';
    v_tokens := v_rats * public.config_int('tokens_per_rat');
  end if;

  update public.sightings
     set status = v_status,
         reject_reason = v_reason,
         rats_detected = v_detected,
         rats_awarded = case when v_status = 'accepted' then v_rats else 0 end,
         tokens_awarded = v_tokens,
         is_selfie = v_selfie,
         has_third_party_faces = v_faces,
         tags = coalesce(array(select jsonb_array_elements_text(p_verification -> 'tags')), '{}'),
         public_on_map = v_status in ('accepted', 'accepted_no_points') and not v_selfie and not v_faces,
         verifier = p_verifier,
         verifier_raw = p_verification -> 'raw'
   where id = p_id;

  if v_status = 'accepted' then
    update public.profiles
       set total_rats = total_rats + v_rats,
           tokens_balance = tokens_balance + v_tokens
     where id = s.user_id;

    insert into public.token_ledger (user_id, delta, reason, ref_id)
    values (s.user_id, v_tokens, 'sighting', p_id);
  end if;
end;
$$;

create function public.record_sighting(
  p_id uuid,
  p_user_id uuid,
  p_lon double precision,
  p_lat double precision,
  p_accuracy_m real,
  p_captured_at timestamptz,
  p_photo_bucket text,
  p_photo_path text,
  p_phash text,
  p_verifier text,
  p_verification jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Blokada wiersza profilu szereguje równoległe zgłoszenia jednej osoby.
  perform 1 from public.profiles where id = p_user_id for update;

  if (select count(*) from public.sightings
       where user_id = p_user_id and created_at >= public.warsaw_day_start())
     >= public.config_int('daily_submission_limit') then
    return jsonb_build_object('status', 'blocked', 'reason', 'daily_limit');
  end if;

  insert into public.sightings (
    id, user_id, status, location, location_accuracy_m, captured_at,
    photo_bucket, photo_path, phash, verifier
  ) values (
    p_id, p_user_id, 'pending',
    extensions.st_setsrid(extensions.st_makepoint(p_lon, p_lat), 4326)::extensions.geography,
    p_accuracy_m, p_captured_at, p_photo_bucket, p_photo_path, ('x' || p_phash)::bit(64), p_verifier
  );

  if p_verification is not null then
    perform public.apply_verification(p_id, p_verification, p_verifier);
  end if;

  return public.sighting_result(p_id);
end;
$$;

create function public.resolve_pending(
  p_id uuid,
  p_photo_bucket text,
  p_photo_path text,
  p_verifier text,
  p_verification jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sightings
     set photo_bucket = p_photo_bucket,
         photo_path = p_photo_path
   where id = p_id and status = 'pending';

  perform public.apply_verification(p_id, p_verification, p_verifier);
  return public.sighting_result(p_id);
end;
$$;

create function public.fail_verification(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sightings
     set verify_attempts = verify_attempts + 1,
         status = case when verify_attempts + 1 >= public.config_int('max_verify_attempts') then 'rejected' else status end,
         reject_reason = case when verify_attempts + 1 >= public.config_int('max_verify_attempts') then 'verification_failed' else reject_reason end
   where id = p_id and status = 'pending';

  return public.sighting_result(p_id);
end;
$$;

create function public.list_pending_sightings(p_user_id uuid)
returns table (id uuid, photo_bucket text, photo_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.photo_bucket, s.photo_path
    from public.sightings s
   where s.user_id = p_user_id and s.status = 'pending'
   order by s.created_at
   limit 5
$$;

revoke execute on function public.precheck_sighting(uuid, double precision, double precision, real, text) from public, anon, authenticated;
revoke execute on function public.sighting_result(uuid) from public, anon, authenticated;
revoke execute on function public.apply_verification(uuid, jsonb, text) from public, anon, authenticated;
revoke execute on function public.record_sighting(uuid, uuid, double precision, double precision, real, timestamptz, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.resolve_pending(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.fail_verification(uuid) from public, anon, authenticated;
revoke execute on function public.list_pending_sightings(uuid) from public, anon, authenticated;

grant execute on function public.precheck_sighting(uuid, double precision, double precision, real, text) to service_role;
grant execute on function public.record_sighting(uuid, uuid, double precision, double precision, real, timestamptz, text, text, text, text, jsonb) to service_role;
grant execute on function public.resolve_pending(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.fail_verification(uuid) to service_role;
grant execute on function public.list_pending_sightings(uuid) to service_role;
```

- [ ] **Step 4: Zastosuj migrację i uruchom testy**

Run: `npm run db:reset && npm run test:db`
Expected: `Result: PASS` (profiles 10, config_ranks_city 10, sightings 28).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261001000200_sightings.sql supabase/tests/sightings.test.sql
git commit -m "feat: add sightings, token ledger and server-side scoring functions"
```

---

### Task 3: Wynik weryfikacji i weryfikatory (Gemini, fake)

**Files:**
- Create: `supabase/functions/_shared/verification.ts`, `supabase/functions/_shared/verification.test.ts`, `supabase/functions/_shared/geminiVerifier.ts`, `supabase/functions/_shared/geminiVerifier.test.ts`, `supabase/functions/_shared/selectVerifier.ts`, `supabase/functions/_shared/selectVerifier.test.ts`
- Modify: `vite.config.ts` (zakres testów), `package.json` (zależności deweloperskie)

**Interfaces:**
- Consumes: nic
- Produces:
  - `verification.ts`: `ALLOWED_TAGS`, `type AllowedTag`, `interface VerificationResult { ratCount: number; isSelfie: boolean; isScreenOrPrint: boolean; isToyOrDrawing: boolean; hasThirdPartyFaces: boolean; tags: AllowedTag[]; raw: unknown }`, `interface RatVerifier { readonly name: string; verify(jpeg: Uint8Array): Promise<VerificationResult> }`, `class VerifierUnavailableError extends Error`, `parseVerification(json: unknown): VerificationResult` (rzuca `ZodError`), `isPublicCandidate(v: VerificationResult | null): boolean`
  - `geminiVerifier.ts`: `DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash'`, `createGeminiVerifier(options: { apiKey: string; model: string; fetch?: typeof fetch; timeoutMs?: number }): RatVerifier` (name `'gemini:<model>'`), `toBase64(bytes: Uint8Array): string`
  - `selectVerifier.ts`: `createFakeVerifier(ratCount: number): RatVerifier` (name `'fake'`), `selectVerifier(getEnv: (key: string) => string | undefined, fetchImpl?: typeof fetch): RatVerifier`

- [ ] **Step 1: Zależności i zakres testów**

```bash
npm install -D zod jpeg-js
```

W `vite.config.ts` w sekcji `test` zamień linię `include` na:

```ts
    include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/**/*.test.ts', 'scripts/**/*.test.ts'],
```

- [ ] **Step 2: Napisz testy wyniku weryfikacji**

Utwórz `supabase/functions/_shared/verification.test.ts`:

```ts
// @vitest-environment node
import { expect, test } from 'vitest'
import { isPublicCandidate, parseVerification, type VerificationResult } from './verification.ts'

const base = {
  ratCount: 2,
  isSelfie: false,
  isScreenOrPrint: false,
  isToyOrDrawing: false,
  hasThirdPartyFaces: false,
  tags: ['smietnik', 'kot', 'deszcz'],
}

test('odczytuje poprawną odpowiedź i odrzuca nieznane tagi', () => {
  const result = parseVerification(base)
  expect(result).toEqual({ ...base, tags: ['smietnik', 'deszcz'], raw: base })
})

test('odrzuca odpowiedź bez wymaganych pól', () => {
  expect(() => parseVerification({ ratCount: 1 })).toThrow()
})

test('odrzuca ujemną liczbę szczurów', () => {
  expect(() => parseVerification({ ...base, ratCount: -1 })).toThrow()
})

const accepted: VerificationResult = { ...base, tags: [], raw: {} }

test.each([
  ['zaliczony szczur', accepted, true],
  ['brak weryfikacji', null, false],
  ['brak szczura', { ...accepted, ratCount: 0 }, false],
  ['zdjęcie ekranu', { ...accepted, isScreenOrPrint: true }, false],
  ['zabawka', { ...accepted, isToyOrDrawing: true }, false],
  ['selfie', { ...accepted, isSelfie: true }, false],
  ['twarze osób trzecich', { ...accepted, hasThirdPartyFaces: true }, false],
])('publiczne zdjęcie: %s', (_name, input, expected) => {
  expect(isPublicCandidate(input)).toBe(expected)
})
```

Run: `npx vitest run supabase/functions/_shared/verification.test.ts`
Expected: FAIL — `Failed to resolve import "./verification.ts"`.

- [ ] **Step 3: Implementacja wyniku weryfikacji**

Utwórz `supabase/functions/_shared/verification.ts`:

```ts
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
```

Run: `npx vitest run supabase/functions/_shared/verification.test.ts`
Expected: PASS.

- [ ] **Step 4: Napisz testy weryfikatora Gemini**

Utwórz `supabase/functions/_shared/geminiVerifier.test.ts`:

```ts
// @vitest-environment node
import { expect, test, vi } from 'vitest'
import { createGeminiVerifier, toBase64 } from './geminiVerifier.ts'
import { VerifierUnavailableError } from './verification.ts'

const photo = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
const answer = {
  ratCount: 1,
  isSelfie: false,
  isScreenOrPrint: false,
  isToyOrDrawing: false,
  hasThirdPartyFaces: false,
  tags: ['woda'],
}

function geminiResponse(text: string, status = 200) {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: 'myślę…', thought: true }, { text }] } }] }),
    { status, headers: { 'Content-Type': 'application/json' } },
  )
}

test('koduje bajty do base64', () => {
  expect(toBase64(new Uint8Array([72, 105]))).toBe('SGk=')
})

test('wysyła zdjęcie z poleceniem i schematem, zwraca wynik', async () => {
  const fetchMock = vi.fn(async () => geminiResponse(JSON.stringify(answer)))
  const verifier = createGeminiVerifier({ apiKey: 'klucz', model: 'gemini-test', fetch: fetchMock })

  const result = await verifier.verify(photo)

  expect(result).toEqual({ ...answer, tags: ['woda'], raw: answer })
  expect(verifier.name).toBe('gemini:gemini-test')
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent')
  expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('klucz')
  const body = JSON.parse(init.body as string)
  expect(body.contents[0].parts[1].inline_data).toEqual({ mime_type: 'image/jpeg', data: toBase64(photo) })
  expect(body.generationConfig.responseMimeType).toBe('application/json')
  expect(body.generationConfig.responseSchema.required).toContain('ratCount')
})

test.each([429, 500, 503])('HTTP %i oznacza chwilową niedostępność', async (status) => {
  const verifier = createGeminiVerifier({ apiKey: 'k', model: 'm', fetch: vi.fn(async () => new Response('{}', { status })) })
  await expect(verifier.verify(photo)).rejects.toBeInstanceOf(VerifierUnavailableError)
})

test('błąd sieci oznacza chwilową niedostępność', async () => {
  const verifier = createGeminiVerifier({ apiKey: 'k', model: 'm', fetch: vi.fn(async () => Promise.reject(new TypeError('fetch failed'))) })
  await expect(verifier.verify(photo)).rejects.toBeInstanceOf(VerifierUnavailableError)
})

test('niepoprawny JSON od modelu oznacza chwilową niedostępność', async () => {
  const verifier = createGeminiVerifier({ apiKey: 'k', model: 'm', fetch: vi.fn(async () => geminiResponse('to nie JSON')) })
  await expect(verifier.verify(photo)).rejects.toBeInstanceOf(VerifierUnavailableError)
})

test('zły klucz (403) to błąd konfiguracji, a nie niedostępność', async () => {
  const verifier = createGeminiVerifier({ apiKey: 'zly', model: 'm', fetch: vi.fn(async () => new Response('{}', { status: 403 })) })
  const error = await verifier.verify(photo).catch((caught: unknown) => caught)
  expect(error).toBeInstanceOf(Error)
  expect(error).not.toBeInstanceOf(VerifierUnavailableError)
})
```

Run: `npx vitest run supabase/functions/_shared/geminiVerifier.test.ts`
Expected: FAIL — `Failed to resolve import "./geminiVerifier.ts"`.

- [ ] **Step 5: Implementacja weryfikatora Gemini**

Utwórz `supabase/functions/_shared/geminiVerifier.ts`:

```ts
import { ALLOWED_TAGS, parseVerification, VerifierUnavailableError, type RatVerifier } from './verification.ts'

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash'

const PROMPT = `You verify photos for Ratlas, a game where people in Wrocław, Poland photograph rats they meet in the city.
Answer strictly with the JSON schema.
- ratCount: number of real rats clearly visible (alive or dead). Mice, squirrels, hamsters, guinea pigs, pigeons and other animals are NOT rats. Pet rats count.
- isSelfie: true if the photographer's own face is visible together with the rat.
- isScreenOrPrint: true if the photo shows a screen (phone, monitor, TV) or a printed picture instead of a real scene.
- isToyOrDrawing: true if the "rat" is a toy, plush, figurine, drawing, graffiti, sculpture or statue.
- hasThirdPartyFaces: true if a recognisable face of another person (not the selfie author) is visible.
- tags: zero or more of: smietnik (garbage bin, dumpster or trash), krasnal (a small bronze dwarf statue typical of Wrocław), woda (river, canal or water nearby), tramwaj_przystanek (tram, tram tracks or a tram/bus stop), deszcz (it is raining or wet from rain). Use only these exact values.`

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ratCount: { type: 'INTEGER' },
    isSelfie: { type: 'BOOLEAN' },
    isScreenOrPrint: { type: 'BOOLEAN' },
    isToyOrDrawing: { type: 'BOOLEAN' },
    hasThirdPartyFaces: { type: 'BOOLEAN' },
    tags: { type: 'ARRAY', items: { type: 'STRING', enum: [...ALLOWED_TAGS] } },
  },
  required: ['ratCount', 'isSelfie', 'isScreenOrPrint', 'isToyOrDrawing', 'hasThirdPartyFaces', 'tags'],
}

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

interface GeminiPart {
  text?: string
  thought?: boolean
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[]
}

export function createGeminiVerifier(options: {
  apiKey: string
  model: string
  fetch?: typeof fetch
  timeoutMs?: number
}): RatVerifier {
  const doFetch = options.fetch ?? fetch
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent`

  return {
    name: `gemini:${options.model}`,
    async verify(jpeg) {
      const body = {
        contents: [
          {
            role: 'user',
            parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: toBase64(jpeg) } }],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, temperature: 0 },
      }

      let response: Response
      try {
        response = await doFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': options.apiKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
        })
      } catch (error) {
        throw new VerifierUnavailableError(`Gemini: brak odpowiedzi (${String(error)})`)
      }

      if (response.status === 429 || response.status >= 500) {
        throw new VerifierUnavailableError(`Gemini: HTTP ${response.status}`)
      }
      if (!response.ok) {
        // 400/401/403/404: zły klucz, model albo zapytanie — to trzeba naprawić, a nie ponawiać.
        throw new Error(`Gemini: HTTP ${response.status} ${await response.text()}`)
      }

      const json = (await response.json()) as GeminiResponse
      const text = json.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string' && !part.thought)?.text
      try {
        return parseVerification(JSON.parse(text ?? ''))
      } catch (error) {
        throw new VerifierUnavailableError(`Gemini: niepoprawna odpowiedź (${String(error)})`)
      }
    },
  }
}
```

Run: `npx vitest run supabase/functions/_shared/geminiVerifier.test.ts`
Expected: PASS.

- [ ] **Step 6: Napisz testy wyboru weryfikatora**

Utwórz `supabase/functions/_shared/selectVerifier.test.ts`:

```ts
// @vitest-environment node
import { expect, test, vi } from 'vitest'
import { createFakeVerifier, selectVerifier } from './selectVerifier.ts'

const env = (values: Record<string, string>) => (key: string) => values[key]

test('fake zwraca zadaną liczbę szczurów bez sieci', async () => {
  const result = await createFakeVerifier(2).verify(new Uint8Array([1]))
  expect(result.ratCount).toBe(2)
  expect(result.isScreenOrPrint).toBe(false)
})

test('VERIFIER=fake wybiera weryfikator testowy', () => {
  const verifier = selectVerifier(env({ VERIFIER: 'fake', FAKE_RAT_COUNT: '3' }))
  expect(verifier.name).toBe('fake')
})

test('domyślnie wybiera Gemini z domyślnym modelem', () => {
  const verifier = selectVerifier(env({ GEMINI_API_KEY: 'k' }), vi.fn())
  expect(verifier.name).toBe('gemini:gemini-3.5-flash')
})

test('GEMINI_MODEL zmienia model', () => {
  const verifier = selectVerifier(env({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-inny' }), vi.fn())
  expect(verifier.name).toBe('gemini:gemini-inny')
})

test('bez klucza i bez fake zgłasza błąd konfiguracji', () => {
  expect(() => selectVerifier(env({}))).toThrow('GEMINI_API_KEY')
})
```

Run: `npx vitest run supabase/functions/_shared/selectVerifier.test.ts`
Expected: FAIL — `Failed to resolve import "./selectVerifier.ts"`.

- [ ] **Step 7: Implementacja wyboru weryfikatora**

Utwórz `supabase/functions/_shared/selectVerifier.ts`:

```ts
import { createGeminiVerifier, DEFAULT_GEMINI_MODEL } from './geminiVerifier.ts'
import type { RatVerifier } from './verification.ts'

// Tylko do lokalnego rozwoju: każde zdjęcie to `ratCount` szczurów. Nigdy nie ustawiaj VERIFIER=fake na produkcji.
export function createFakeVerifier(ratCount: number): RatVerifier {
  return {
    name: 'fake',
    verify() {
      const answer = {
        ratCount,
        isSelfie: false,
        isScreenOrPrint: false,
        isToyOrDrawing: false,
        hasThirdPartyFaces: false,
        tags: [],
      }
      return Promise.resolve({ ...answer, raw: answer })
    },
  }
}

export function selectVerifier(getEnv: (key: string) => string | undefined, fetchImpl?: typeof fetch): RatVerifier {
  if (getEnv('VERIFIER') === 'fake') {
    return createFakeVerifier(Number(getEnv('FAKE_RAT_COUNT') ?? '1'))
  }
  const apiKey = getEnv('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('Brak GEMINI_API_KEY (lokalnie możesz ustawić VERIFIER=fake w supabase/functions/.env)')
  }
  return createGeminiVerifier({ apiKey, model: getEnv('GEMINI_MODEL') ?? DEFAULT_GEMINI_MODEL, fetch: fetchImpl })
}
```

- [ ] **Step 8: Uruchom wszystkie testy**

Run: `npm test && npx tsc -b`
Expected: wszystkie testy przechodzą (frontend + nowe testy `_shared`), `tsc` bez błędów.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vite.config.ts supabase/functions/_shared
git commit -m "feat: add rat verification contract with Gemini and fake verifiers"
```

---

### Task 4: Odcisk zdjęcia (dHash) i odczyt formularza zgłoszenia

**Files:**
- Create: `supabase/functions/_shared/imageHash.ts`, `supabase/functions/_shared/imageHash.test.ts`, `supabase/functions/_shared/pipeline.ts`, `supabase/functions/_shared/pipeline.test.ts`

**Interfaces:**
- Consumes: `VerificationResult`, `isPublicCandidate` (Task 3)
- Produces:
  - `imageHash.ts`: `differenceHash(jpeg: Uint8Array): string` (16 znaków hex), `hammingDistance(a: string, b: string): number`
  - `pipeline.ts`: `MAX_PHOTO_BYTES = 3 * 1024 * 1024`, `PUBLIC_BUCKET = 'map-photos'`, `PRIVATE_BUCKET = 'sightings-private'`, `interface SightingInput { lat: number; lon: number; accuracyM: number; capturedAt: string }`, `type ParsedSighting = { ok: true; input: SightingInput; photo: Uint8Array } | { ok: false }`, `parseSightingForm(form: FormData): Promise<ParsedSighting>` (pola: `photo` JPEG, `lat`, `lon`, `accuracy`, `capturedAt` ISO), `photoPlacement(userId: string, sightingId: string, verification: VerificationResult | null): { bucket: string; path: string }`

- [ ] **Step 1: Napisz testy odcisku**

Utwórz `supabase/functions/_shared/imageHash.test.ts`:

```ts
// @vitest-environment node
import jpeg from 'jpeg-js'
import { expect, test } from 'vitest'
import { differenceHash, hammingDistance } from './imageHash.ts'

// Obraz testowy: poziomy gradient z „plamą” — deterministyczny, z wyraźną strukturą.
function makeJpeg(width: number, height: number, quality: number, mirrored = false): Uint8Array {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const u = mirrored ? width - 1 - x : x
      const blob = Math.hypot(u - width * 0.3, y - height * 0.6) < height * 0.2 ? 90 : 0
      const value = Math.min(255, Math.round((u / width) * 160 + (y / height) * 40 + blob))
      data[i] = value
      data[i + 1] = value
      data[i + 2] = value
      data[i + 3] = 255
    }
  }
  return new Uint8Array(jpeg.encode({ data, width, height }, quality).data)
}

test('odcisk ma 16 znaków szesnastkowych', () => {
  expect(differenceHash(makeJpeg(160, 120, 90))).toMatch(/^[0-9a-f]{16}$/)
})

test('to samo zdjęcie w innej jakości i rozmiarze ma prawie ten sam odcisk', () => {
  const original = differenceHash(makeJpeg(640, 480, 90))
  expect(hammingDistance(original, differenceHash(makeJpeg(640, 480, 40)))).toBeLessThanOrEqual(6)
  expect(hammingDistance(original, differenceHash(makeJpeg(320, 240, 80)))).toBeLessThanOrEqual(6)
})

test('lustrzane odbicie ma zupełnie inny odcisk', () => {
  const original = differenceHash(makeJpeg(640, 480, 90))
  expect(hammingDistance(original, differenceHash(makeJpeg(640, 480, 90, true)))).toBeGreaterThan(20)
})

test('odległość Hamminga liczy różne bity', () => {
  expect(hammingDistance('0000000000000000', '0000000000000003')).toBe(2)
  expect(hammingDistance('ffffffffffffffff', '0000000000000000')).toBe(64)
})
```

Run: `npx vitest run supabase/functions/_shared/imageHash.test.ts`
Expected: FAIL — `Failed to resolve import "./imageHash.ts"`.

- [ ] **Step 2: Implementacja odcisku**

Utwórz `supabase/functions/_shared/imageHash.ts`:

```ts
import jpeg from 'jpeg-js'

const COLS = 9
const ROWS = 8

// dHash: jasność uśredniona w siatce 9×8; bit = czy komórka jest jaśniejsza od sąsiadki z prawej.
// Odporny na zmianę rozmiaru i kompresji, więc wykrywa ponowne wrzucenie tego samego zdjęcia.
export function differenceHash(jpegBytes: Uint8Array): string {
  const { width, height, data } = jpeg.decode(jpegBytes, {
    useTArray: true,
    formatAsRGBA: true,
    maxMemoryUsageInMB: 256,
  })
  const sums = new Float64Array(COLS * ROWS)
  const counts = new Uint32Array(COLS * ROWS)

  for (let y = 0; y < height; y++) {
    const row = Math.min(ROWS - 1, Math.floor((y * ROWS) / height))
    for (let x = 0; x < width; x++) {
      const col = Math.min(COLS - 1, Math.floor((x * COLS) / width))
      const i = (y * width + x) * 4
      sums[row * COLS + col] += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      counts[row * COLS + col] += 1
    }
  }

  let bits = ''
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS - 1; col++) {
      const left = sums[row * COLS + col] / counts[row * COLS + col]
      const right = sums[row * COLS + col + 1] / counts[row * COLS + col + 1]
      bits += left > right ? '1' : '0'
    }
  }
  return BigInt(`0b${bits}`).toString(16).padStart(16, '0')
}

export function hammingDistance(a: string, b: string): number {
  let diff = BigInt(`0x${a}`) ^ BigInt(`0x${b}`)
  let count = 0
  while (diff > 0n) {
    count += Number(diff & 1n)
    diff >>= 1n
  }
  return count
}
```

Run: `npx vitest run supabase/functions/_shared/imageHash.test.ts`
Expected: PASS.

- [ ] **Step 3: Napisz testy formularza**

Utwórz `supabase/functions/_shared/pipeline.test.ts`:

```ts
// @vitest-environment node
import { expect, test } from 'vitest'
import { parseSightingForm, photoPlacement, PRIVATE_BUCKET, PUBLIC_BUCKET } from './pipeline.ts'
import type { VerificationResult } from './verification.ts'

function form(overrides: Record<string, string | Blob | null> = {}) {
  const values: Record<string, string | Blob | null> = {
    photo: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
    lat: '51.11',
    lon: '17.032',
    accuracy: '12.5',
    capturedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  }
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) {
    if (value === null) continue
    if (value instanceof Blob) data.append(key, value, 'photo.jpg')
    else data.append(key, value)
  }
  return data
}

test('odczytuje poprawny formularz', async () => {
  const parsed = await parseSightingForm(form())
  expect(parsed).toEqual({
    ok: true,
    input: { lat: 51.11, lon: 17.032, accuracyM: 12.5, capturedAt: '2026-10-01T10:00:00.000Z' },
    photo: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  })
})

test.each([
  ['brak zdjęcia', { photo: null }],
  ['zły typ zdjęcia', { photo: new Blob(['x'], { type: 'image/png' }) }],
  ['za duże zdjęcie', { photo: new Blob([new Uint8Array(3 * 1024 * 1024 + 1)], { type: 'image/jpeg' }) }],
  ['szerokość poza zakresem', { lat: '91' }],
  ['długość nie jest liczbą', { lon: 'abc' }],
  ['ujemna dokładność', { accuracy: '-1' }],
  ['zła data', { capturedAt: 'wczoraj' }],
])('odrzuca: %s', async (_name, overrides) => {
  expect(await parseSightingForm(form(overrides))).toEqual({ ok: false })
})

const verification: VerificationResult = {
  ratCount: 1,
  isSelfie: false,
  isScreenOrPrint: false,
  isToyOrDrawing: false,
  hasThirdPartyFaces: false,
  tags: [],
  raw: {},
}

test('zaliczone zdjęcie trafia do publicznego bucketu', () => {
  expect(photoPlacement('u1', 's1', verification)).toEqual({ bucket: PUBLIC_BUCKET, path: 's1.jpg' })
})

test('selfie i zgłoszenia bez weryfikacji trafiają do prywatnego bucketu', () => {
  expect(photoPlacement('u1', 's1', { ...verification, isSelfie: true })).toEqual({ bucket: PRIVATE_BUCKET, path: 'u1/s1.jpg' })
  expect(photoPlacement('u1', 's1', null)).toEqual({ bucket: PRIVATE_BUCKET, path: 'u1/s1.jpg' })
})
```

Run: `npx vitest run supabase/functions/_shared/pipeline.test.ts`
Expected: FAIL — `Failed to resolve import "./pipeline.ts"`.

- [ ] **Step 4: Implementacja formularza**

Utwórz `supabase/functions/_shared/pipeline.ts`:

```ts
import { isPublicCandidate, type VerificationResult } from './verification.ts'

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024
export const PUBLIC_BUCKET = 'map-photos'
export const PRIVATE_BUCKET = 'sightings-private'

export interface SightingInput {
  lat: number
  lon: number
  accuracyM: number
  capturedAt: string
}

export type ParsedSighting = { ok: true; input: SightingInput; photo: Uint8Array } | { ok: false }

export async function parseSightingForm(form: FormData): Promise<ParsedSighting> {
  const photo = form.get('photo')
  if (!(photo instanceof Blob) || photo.type !== 'image/jpeg' || photo.size === 0 || photo.size > MAX_PHOTO_BYTES) {
    return { ok: false }
  }

  const lat = Number(form.get('lat'))
  const lon = Number(form.get('lon'))
  const accuracyM = Number(form.get('accuracy'))
  const capturedAt = Date.parse(String(form.get('capturedAt') ?? ''))
  if (
    !Number.isFinite(lat) || lat < -90 || lat > 90 ||
    !Number.isFinite(lon) || lon < -180 || lon > 180 ||
    !Number.isFinite(accuracyM) || accuracyM < 0 ||
    Number.isNaN(capturedAt)
  ) {
    return { ok: false }
  }

  return {
    ok: true,
    input: { lat, lon, accuracyM, capturedAt: new Date(capturedAt).toISOString() },
    photo: new Uint8Array(await photo.arrayBuffer()),
  }
}

export function photoPlacement(
  userId: string,
  sightingId: string,
  verification: VerificationResult | null,
): { bucket: string; path: string } {
  return isPublicCandidate(verification)
    ? { bucket: PUBLIC_BUCKET, path: `${sightingId}.jpg` }
    : { bucket: PRIVATE_BUCKET, path: `${userId}/${sightingId}.jpg` }
}
```

- [ ] **Step 5: Uruchom wszystkie testy**

Run: `npm test && npx tsc -b`
Expected: wszystkie testy przechodzą.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared
git commit -m "feat: add image difference hash and sighting form parsing"
```

---

### Task 5: Edge Functions `submit-sighting` i `retry-pending` oraz buckety Storage

**Files:**
- Create: `supabase/migrations/20261001000300_storage_buckets.sql`, `supabase/tests/storage.test.sql`, `supabase/functions/submit-sighting/index.ts`, `supabase/functions/submit-sighting/deno.json`, `supabase/functions/retry-pending/index.ts`, `supabase/functions/retry-pending/deno.json`, `supabase/functions/.env.example`, `scripts/smoke-sighting.mjs`
- Modify: `supabase/config.toml` (wpisy funkcji, dodaje je `supabase functions new`), `package.json` (skrypty)

**Interfaces:**
- Consumes: funkcje SQL z Task 2; `selectVerifier`, `VerifierUnavailableError` (Task 3); `differenceHash`, `parseSightingForm`, `photoPlacement`, buckety (Task 4)
- Produces (HTTP, oba wymagają `Authorization: Bearer <JWT użytkownika>`; `supabase.functions.invoke` dodaje go sam):
  - `POST /functions/v1/submit-sighting` (multipart: `photo`, `lat`, `lon`, `accuracy`, `capturedAt`) → `200 {"status":"blocked","reason":"daily_limit"|"gps_inaccurate"|"outside_city"|"duplicate"}` albo `200` wynik `sighting_result` (`status`: `accepted`|`accepted_no_points`|`rejected`|`pending`); `400 {"error":"bad_request"}`
  - `POST /functions/v1/retry-pending` → `200 {"resolved": number}` (ile zaległych zgłoszeń rozstrzygnięto)
  - buckety `map-photos` (publiczny) i `sightings-private` (autor czyta swoje)
  - skrypty npm `functions:serve`, `smoke`

- [ ] **Step 1: Napisz test bucketów**

Utwórz `supabase/tests/storage.test.sql`:

```sql
begin;
select plan(3);

select is(
  (select public from storage.buckets where id = 'map-photos'),
  true,
  'zdjęcia na mapę są publiczne'
);

select is(
  (select public from storage.buckets where id = 'sightings-private'),
  false,
  'pozostałe zdjęcia są prywatne'
);

select is(
  (select allowed_mime_types from storage.buckets where id = 'sightings-private'),
  array['image/jpeg'],
  'przyjmujemy tylko JPEG'
);

select * from finish();
rollback;
```

Run: `npm run test:db`
Expected: FAIL w `storage.test.sql` (brak bucketów).

- [ ] **Step 2: Migracja bucketów**

Utwórz `supabase/migrations/20261001000300_storage_buckets.sql`:

```sql
-- Zdjęcia zgłoszeń. Zapisuje wyłącznie Edge Function (service_role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('map-photos', 'map-photos', true, 3145728, array['image/jpeg']),
  ('sightings-private', 'sightings-private', false, 3145728, array['image/jpeg']);

-- Autor może obejrzeć swoje prywatne zdjęcia (np. selfie) — ścieżka zaczyna się od jego id.
create policy "sightings-private: owner can read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'sightings-private'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
```

Run: `npm run db:reset && npm run test:db`
Expected: `Result: PASS`.

- [ ] **Step 3: Utwórz funkcje i skrypty**

```bash
npx supabase functions new submit-sighting
npx supabase functions new retry-pending
npm pkg set scripts.functions:serve="supabase functions serve --env-file supabase/functions/.env" scripts.smoke="node scripts/smoke-sighting.mjs"
```

Expected: powstają katalogi `supabase/functions/submit-sighting/` i `retry-pending/` (z `index.ts`, `deno.json`, `.npmrc`), a w `supabase/config.toml` sekcje `[functions.submit-sighting]` i `[functions.retry-pending]` z `verify_jwt = false`. Sprawdź to: `grep -A2 "functions.submit-sighting\|functions.retry-pending" supabase/config.toml`. Jeśli `verify_jwt` jest `true`, zmień na `false` (JWT weryfikuje `withSupabase`).

Zastąp `supabase/functions/submit-sighting/deno.json` **i** `supabase/functions/retry-pending/deno.json` tą samą treścią:

```json
{
  "imports": {
    "@supabase/functions-js": "jsr:@supabase/functions-js@^2",
    "@supabase/server": "npm:@supabase/server@^1",
    "jpeg-js": "npm:jpeg-js@^0.4.4",
    "zod": "npm:zod@^4"
  }
}
```

Utwórz `supabase/functions/.env.example`:

```
# Skopiuj do supabase/functions/.env (plik jest ignorowany przez git).
# VERIFIER=fake — bez Gemini: każde zdjęcie to FAKE_RAT_COUNT szczurów. TYLKO lokalnie, nigdy na produkcji.
VERIFIER=fake
FAKE_RAT_COUNT=1
# Z prawdziwym Gemini: usuń VERIFIER=fake i wpisz klucz z https://aistudio.google.com
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash
```

```bash
cp supabase/functions/.env.example supabase/functions/.env
git check-ignore supabase/functions/.env
```

Expected: `git check-ignore` wypisuje ścieżkę (plik ignorowany).

- [ ] **Step 4: Funkcja `submit-sighting`**

Zastąp `supabase/functions/submit-sighting/index.ts`:

```ts
import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import { differenceHash } from '../_shared/imageHash.ts'
import { parseSightingForm, photoPlacement } from '../_shared/pipeline.ts'
import { selectVerifier } from '../_shared/selectVerifier.ts'
import { VerifierUnavailableError, type VerificationResult } from '../_shared/verification.ts'

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 })

    const userId = ctx.userClaims!.id
    const admin = ctx.supabaseAdmin
    const parsed = await parseSightingForm(await req.formData())
    if (!parsed.ok) return Response.json({ error: 'bad_request' }, { status: 400 })
    const { input, photo } = parsed

    // 1. Tanie kontrole przed wywołaniem modelu.
    const phash = differenceHash(photo)
    const { data: blocked, error: precheckError } = await admin.rpc('precheck_sighting', {
      p_user_id: userId,
      p_lon: input.lon,
      p_lat: input.lat,
      p_accuracy_m: input.accuracyM,
      p_phash: phash,
    })
    if (precheckError) throw precheckError
    if (blocked) return Response.json({ status: 'blocked', reason: blocked })

    // 2. Model; gdy chwilowo niedostępny, zgłoszenie zostaje jako „pending”.
    const verifier = selectVerifier((key) => Deno.env.get(key))
    let verification: VerificationResult | null = null
    try {
      verification = await verifier.verify(photo)
    } catch (error) {
      if (!(error instanceof VerifierUnavailableError)) throw error
      console.warn(error.message)
    }

    // 3. Zdjęcie do właściwego bucketu, potem zapis i naliczenie punktów w jednej transakcji SQL.
    const id = crypto.randomUUID()
    const place = photoPlacement(userId, id, verification)
    const upload = await admin.storage.from(place.bucket).upload(place.path, photo, { contentType: 'image/jpeg' })
    if (upload.error) throw upload.error

    const { data: result, error: recordError } = await admin.rpc('record_sighting', {
      p_id: id,
      p_user_id: userId,
      p_lon: input.lon,
      p_lat: input.lat,
      p_accuracy_m: input.accuracyM,
      p_captured_at: input.capturedAt,
      p_photo_bucket: place.bucket,
      p_photo_path: place.path,
      p_phash: phash,
      p_verifier: verifier.name,
      p_verification: verification,
    })
    if (recordError || result?.status === 'blocked') {
      await admin.storage.from(place.bucket).remove([place.path])
    }
    if (recordError) throw recordError

    return Response.json(result)
  }),
}
```

- [ ] **Step 5: Funkcja `retry-pending`**

Zastąp `supabase/functions/retry-pending/index.ts`:

```ts
import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import { photoPlacement } from '../_shared/pipeline.ts'
import { selectVerifier } from '../_shared/selectVerifier.ts'
import { isPublicCandidate, VerifierUnavailableError } from '../_shared/verification.ts'

interface PendingSighting {
  id: string
  photo_bucket: string
  photo_path: string
}

// Wywoływana przez aplikację przy starcie: rozstrzyga zaległe zgłoszenia zalogowanej osoby.
export default {
  fetch: withSupabase({ auth: 'user' }, async (_req, ctx) => {
    const userId = ctx.userClaims!.id
    const admin = ctx.supabaseAdmin

    const { data, error } = await admin.rpc('list_pending_sightings', { p_user_id: userId })
    if (error) throw error
    const pending = (data ?? []) as PendingSighting[]
    if (pending.length === 0) return Response.json({ resolved: 0 })

    const verifier = selectVerifier((key) => Deno.env.get(key))
    let resolved = 0

    for (const sighting of pending) {
      const download = await admin.storage.from(sighting.photo_bucket).download(sighting.photo_path)
      if (download.error) throw download.error
      const photo = new Uint8Array(await download.data.arrayBuffer())

      let verification
      try {
        verification = await verifier.verify(photo)
      } catch (verifyError) {
        if (!(verifyError instanceof VerifierUnavailableError)) throw verifyError
        const { error: failError } = await admin.rpc('fail_verification', { p_id: sighting.id })
        if (failError) throw failError
        continue
      }

      let place = { bucket: sighting.photo_bucket, path: sighting.photo_path }
      if (isPublicCandidate(verification)) {
        const target = photoPlacement(userId, sighting.id, verification)
        const move = await admin.storage
          .from(sighting.photo_bucket)
          .move(sighting.photo_path, target.path, { destinationBucket: target.bucket })
        if (move.error) throw move.error
        place = target
      }

      const { error: resolveError } = await admin.rpc('resolve_pending', {
        p_id: sighting.id,
        p_photo_bucket: place.bucket,
        p_photo_path: place.path,
        p_verifier: verifier.name,
        p_verification: verification,
      })
      if (resolveError) throw resolveError
      resolved += 1
    }

    return Response.json({ resolved })
  }),
}
```

- [ ] **Step 6: Test dymny na lokalnym Supabase**

Utwórz `scripts/smoke-sighting.mjs`:

```js
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
```

Run (dwa terminale):
1. `npm run db:start` (jeśli nie działa) i `npm run functions:serve` — zostaw uruchomione.
2. `npm run smoke`

Expected: 7 linii zaczynających się od `✓`, kod wyjścia 0. Zatrzymaj `functions:serve` (Ctrl+C).

- [ ] **Step 7: Uruchom wszystkie testy**

Run: `npm test && npx tsc -b && npm run test:db`
Expected: wszystko przechodzi.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20261001000300_storage_buckets.sql supabase/tests/storage.test.sql supabase/functions supabase/config.toml scripts/smoke-sighting.mjs package.json
git status --short supabase/functions   # upewnij się, że supabase/functions/.env NIE jest dodany
git commit -m "feat: add submit-sighting and retry-pending edge functions with photo buckets"
```

---

### Task 6: Zdjęcie, dokładny GPS i API zgłoszeń (frontend)

**Files:**
- Create: `src/report/photo.ts`, `src/report/photo.test.ts`, `src/report/location.ts`, `src/report/location.test.ts`, `src/report/reportApi.ts`, `src/report/reportApi.test.ts`

**Interfaces:**
- Consumes: `supabase` (`src/lib/supabase.ts`); kontrakt HTTP funkcji z Task 5
- Produces:
  - `photo.ts`: `MAX_PHOTO_EDGE = 1600`, `JPEG_QUALITY = 0.82`, `fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number }`, `capturePhoto(video: HTMLVideoElement): Promise<Blob>`
  - `location.ts`: `GPS_MAX_ACCURACY_M = 100`, `GPS_TIMEOUT_MS = 20000`, `interface Fix { lat: number; lon: number; accuracyM: number }`, `type LocationFailure = 'denied' | 'unavailable' | 'inaccurate'`, `class LocationError extends Error { failure: LocationFailure }`, `getAccuratePosition(options?: { maxAccuracyM?: number; timeoutMs?: number; geolocation?: Geolocation }): Promise<Fix>`
  - `reportApi.ts`: `type BlockReason = 'daily_limit' | 'gps_inaccurate' | 'outside_city' | 'duplicate'`, `type RecordedStatus = 'accepted' | 'accepted_no_points' | 'rejected' | 'pending'`, `type SubmitOutcome = { kind: 'blocked'; reason: BlockReason } | { kind: 'recorded'; status: RecordedStatus; rejectReason: string | null; ratsAwarded: number; tokensAwarded: number }`, `type SubmitResult = SubmitOutcome | { kind: 'offline' } | { kind: 'error' }`, `toSubmitResult(data: unknown): SubmitResult`, `submitSighting(photo: Blob, fix: Fix, capturedAt: Date): Promise<SubmitResult>`, `retryPending(): Promise<number>`

- [ ] **Step 1: Napisz testy**

Utwórz `src/report/photo.test.ts`:

```ts
import { expect, test } from 'vitest'
import { fitWithin } from './photo'

test.each([
  [4032, 3024, { width: 1600, height: 1200 }],
  [3024, 4032, { width: 1200, height: 1600 }],
  [1280, 720, { width: 1280, height: 720 }],
  [1601, 1, { width: 1600, height: 1 }],
])('fitWithin(%i, %i)', (width, height, expected) => {
  expect(fitWithin(width, height, 1600)).toEqual(expected)
})
```

Utwórz `src/report/location.test.ts`:

```ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getAccuratePosition, LocationError } from './location'

type Success = (position: GeolocationPosition) => void
type Failure = (error: GeolocationPositionError) => void

function fakeGeolocation() {
  const handlers: { success?: Success; failure?: Failure } = {}
  const geolocation = {
    watchPosition: vi.fn((success: Success, failure: Failure) => {
      handlers.success = success
      handlers.failure = failure
      return 7
    }),
    clearWatch: vi.fn(),
    getCurrentPosition: vi.fn(),
  }
  const report = (accuracy: number) =>
    handlers.success?.({ coords: { latitude: 51.11, longitude: 17.03, accuracy } } as GeolocationPosition)
  const fail = (code: number) => handlers.failure?.({ code } as GeolocationPositionError)
  return { geolocation: geolocation as unknown as Geolocation, report, fail, clearWatch: geolocation.clearWatch }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

test('czeka na wystarczająco dokładną pozycję', async () => {
  const fake = fakeGeolocation()
  const promise = getAccuratePosition({ geolocation: fake.geolocation })
  fake.report(300)
  fake.report(40)
  await expect(promise).resolves.toEqual({ lat: 51.11, lon: 17.03, accuracyM: 40 })
  expect(fake.clearWatch).toHaveBeenCalledWith(7)
})

test('brak zgody to błąd „denied”', async () => {
  const fake = fakeGeolocation()
  const promise = getAccuratePosition({ geolocation: fake.geolocation })
  fake.fail(1)
  await expect(promise).rejects.toMatchObject({ failure: 'denied' })
})

test('po czasie bez dokładnej pozycji to błąd „inaccurate”', async () => {
  const fake = fakeGeolocation()
  const promise = getAccuratePosition({ geolocation: fake.geolocation, timeoutMs: 1000 })
  fake.report(500)
  vi.advanceTimersByTime(1000)
  const error = await promise.catch((caught: unknown) => caught)
  expect(error).toBeInstanceOf(LocationError)
  expect(error).toMatchObject({ failure: 'inaccurate' })
  expect(fake.clearWatch).toHaveBeenCalled()
})
```

Utwórz `src/report/reportApi.test.ts`:

```ts
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { expect, test, vi } from 'vitest'
import { retryPending, submitSighting, toSubmitResult } from './reportApi'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke: mocks.invoke } } }))

test.each([
  [{ status: 'blocked', reason: 'outside_city' }, { kind: 'blocked', reason: 'outside_city' }],
  [
    { status: 'accepted', reject_reason: null, rats_awarded: 3, tokens_awarded: 30 },
    { kind: 'recorded', status: 'accepted', rejectReason: null, ratsAwarded: 3, tokensAwarded: 30 },
  ],
  [
    { status: 'rejected', reject_reason: 'no_rat', rats_awarded: 0, tokens_awarded: 0 },
    { kind: 'recorded', status: 'rejected', rejectReason: 'no_rat', ratsAwarded: 0, tokensAwarded: 0 },
  ],
  [{ status: 'blocked', reason: 'coś' }, { kind: 'error' }],
  [null, { kind: 'error' }],
])('toSubmitResult(%j)', (data, expected) => {
  expect(toSubmitResult(data)).toEqual(expected)
})

const photo = new Blob(['x'], { type: 'image/jpeg' })
const fix = { lat: 51.11, lon: 17.032, accuracyM: 12 }

test('wysyła zdjęcie z pozycją jako formularz', async () => {
  mocks.invoke.mockResolvedValue({ data: { status: 'pending', reject_reason: null, rats_awarded: 0, tokens_awarded: 0 }, error: null })
  const result = await submitSighting(photo, fix, new Date('2026-10-01T10:00:00Z'))

  expect(result).toEqual({ kind: 'recorded', status: 'pending', rejectReason: null, ratsAwarded: 0, tokensAwarded: 0 })
  const [name, options] = mocks.invoke.mock.calls[0]
  expect(name).toBe('submit-sighting')
  const form = options.body as FormData
  expect(form.get('lat')).toBe('51.11')
  expect(form.get('lon')).toBe('17.032')
  expect(form.get('accuracy')).toBe('12')
  expect(form.get('capturedAt')).toBe('2026-10-01T10:00:00.000Z')
  expect(form.get('photo')).toBeInstanceOf(Blob)
})

test('brak sieci to „offline”', async () => {
  mocks.invoke.mockResolvedValue({ data: null, error: new FunctionsFetchError(new TypeError('fetch failed')) })
  expect(await submitSighting(photo, fix, new Date())).toEqual({ kind: 'offline' })
})

test('błąd serwera to „error”', async () => {
  mocks.invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(new Response('{}', { status: 500 })) })
  expect(await submitSighting(photo, fix, new Date())).toEqual({ kind: 'error' })
})

test('retryPending zwraca liczbę rozstrzygniętych, a przy błędzie 0', async () => {
  mocks.invoke.mockResolvedValueOnce({ data: { resolved: 2 }, error: null })
  expect(await retryPending()).toBe(2)
  mocks.invoke.mockResolvedValueOnce({ data: null, error: new FunctionsFetchError(new TypeError('x')) })
  expect(await retryPending()).toBe(0)
})
```

Run: `npx vitest run src/report`
Expected: FAIL — `Failed to resolve import "./photo"` (i pozostałe moduły).

- [ ] **Step 2: Implementacja zdjęcia**

Utwórz `src/report/photo.ts`:

```ts
export const MAX_PHOTO_EDGE = 1600
export const JPEG_QUALITY = 0.82

export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

// Klatka z podglądu aparatu → JPEG. Rysowanie przez canvas nie przenosi EXIF (m.in. GPS z aparatu).
export function capturePhoto(video: HTMLVideoElement): Promise<Blob> {
  const size = fitWithin(video.videoWidth, video.videoHeight, MAX_PHOTO_EDGE)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('Brak kontekstu 2D'))
  context.drawImage(video, 0, 0, size.width, size.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Nie udało się zapisać zdjęcia'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}
```

- [ ] **Step 3: Implementacja GPS**

Utwórz `src/report/location.ts`:

```ts
export const GPS_MAX_ACCURACY_M = 100
export const GPS_TIMEOUT_MS = 20_000

export interface Fix {
  lat: number
  lon: number
  accuracyM: number
}

export type LocationFailure = 'denied' | 'unavailable' | 'inaccurate'

export class LocationError extends Error {
  failure: LocationFailure

  constructor(failure: LocationFailure) {
    super(`location: ${failure}`)
    this.name = 'LocationError'
    this.failure = failure
  }
}

const PERMISSION_DENIED = 1

// Śledzi pozycję, aż dokładność spadnie do maxAccuracyM (GPS „dochodzi” przez kilka sekund).
export function getAccuratePosition(
  options: { maxAccuracyM?: number; timeoutMs?: number; geolocation?: Geolocation } = {},
): Promise<Fix> {
  const maxAccuracyM = options.maxAccuracyM ?? GPS_MAX_ACCURACY_M
  const geolocation = options.geolocation ?? navigator.geolocation

  return new Promise((resolve, reject) => {
    if (!geolocation) {
      reject(new LocationError('unavailable'))
      return
    }

    const watchId = geolocation.watchPosition(
      (position) => {
        const fix = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        }
        if (fix.accuracyM <= maxAccuracyM) {
          finish()
          resolve(fix)
        }
      },
      (error) => {
        finish()
        reject(new LocationError(error.code === PERMISSION_DENIED ? 'denied' : 'unavailable'))
      },
      { enableHighAccuracy: true, maximumAge: 0 },
    )

    const timer = setTimeout(() => {
      finish()
      reject(new LocationError('inaccurate'))
    }, options.timeoutMs ?? GPS_TIMEOUT_MS)

    function finish() {
      geolocation.clearWatch(watchId)
      clearTimeout(timer)
    }
  })
}
```

- [ ] **Step 4: Implementacja API**

Utwórz `src/report/reportApi.ts`:

```ts
import { FunctionsFetchError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Fix } from './location'

export type BlockReason = 'daily_limit' | 'gps_inaccurate' | 'outside_city' | 'duplicate'
export type RecordedStatus = 'accepted' | 'accepted_no_points' | 'rejected' | 'pending'

export type SubmitOutcome =
  | { kind: 'blocked'; reason: BlockReason }
  | { kind: 'recorded'; status: RecordedStatus; rejectReason: string | null; ratsAwarded: number; tokensAwarded: number }

export type SubmitResult = SubmitOutcome | { kind: 'offline' } | { kind: 'error' }

const BLOCK_REASONS: readonly string[] = ['daily_limit', 'gps_inaccurate', 'outside_city', 'duplicate']
const RECORDED_STATUSES: readonly string[] = ['accepted', 'accepted_no_points', 'rejected', 'pending']

export function toSubmitResult(data: unknown): SubmitResult {
  const value = (data ?? {}) as Record<string, unknown>
  if (value.status === 'blocked') {
    return typeof value.reason === 'string' && BLOCK_REASONS.includes(value.reason)
      ? { kind: 'blocked', reason: value.reason as BlockReason }
      : { kind: 'error' }
  }
  if (typeof value.status === 'string' && RECORDED_STATUSES.includes(value.status)) {
    return {
      kind: 'recorded',
      status: value.status as RecordedStatus,
      rejectReason: typeof value.reject_reason === 'string' ? value.reject_reason : null,
      ratsAwarded: Number(value.rats_awarded ?? 0),
      tokensAwarded: Number(value.tokens_awarded ?? 0),
    }
  }
  return { kind: 'error' }
}

export async function submitSighting(photo: Blob, fix: Fix, capturedAt: Date): Promise<SubmitResult> {
  const form = new FormData()
  form.append('photo', photo, 'photo.jpg')
  form.append('lat', String(fix.lat))
  form.append('lon', String(fix.lon))
  form.append('accuracy', String(fix.accuracyM))
  form.append('capturedAt', capturedAt.toISOString())

  const { data, error } = await supabase.functions.invoke('submit-sighting', { body: form })
  if (error) return error instanceof FunctionsFetchError ? { kind: 'offline' } : { kind: 'error' }
  return toSubmitResult(data)
}

export async function retryPending(): Promise<number> {
  const { data, error } = await supabase.functions.invoke('retry-pending', { body: {} })
  if (error) return 0
  return Number((data as { resolved?: number } | null)?.resolved ?? 0)
}
```

- [ ] **Step 5: Uruchom testy**

Run: `npm test && npx tsc -b`
Expected: wszystkie testy przechodzą.

- [ ] **Step 6: Commit**

```bash
git add src/report
git commit -m "feat: add photo capture, accurate GPS and sighting API client"
```

---

### Task 7: Ekran „Zgłoś” i ekran wyniku

**Files:**
- Create: `src/report/CameraView.tsx`, `src/report/ResultView.tsx`, `src/report/ReportScreen.tsx`, `src/report/ReportScreen.test.tsx`, `src/report/report.css`
- Modify: `src/i18n/pl.json`, `src/shell/AppShell.tsx`, `src/main.tsx`

**Interfaces:**
- Consumes: `capturePhoto` (`./photo`), `getAccuratePosition`, `LocationError`, `GPS_MAX_ACCURACY_M`, `Fix` (`./location`), `submitSighting`, `SubmitOutcome` (`./reportApi`)
- Produces: `ReportScreen({ onRecorded }: { onRecorded: () => void })` — `onRecorded` wołane, gdy serwer zapisał zgłoszenie (`kind: 'recorded'`), żeby odświeżyć profil; `ResultView({ outcome, onAgain })`; `CameraView({ facing, onShot, onDenied })`

- [ ] **Step 1: Teksty**

Dodaj do `src/i18n/pl.json` (na najwyższym poziomie, obok istniejących sekcji) dwie sekcje:

```json
  "report": {
    "tip": "Wyceluj w szczura i zrób zdjęcie. Nie podchodź za blisko!",
    "shoot": "Zrób zdjęcie",
    "flip": "Przełącz aparat",
    "locating": "Ustalam lokalizację…",
    "sending": "Sprawdzam zdjęcie…",
    "retry": "Spróbuj ponownie",
    "back": "Wróć do aparatu",
    "problems": {
      "camera_denied": "Potrzebujemy dostępu do aparatu. Zezwól na niego w ustawieniach przeglądarki i wróć tutaj.",
      "location_denied": "Potrzebujemy lokalizacji, żeby zaznaczyć szczura na mapie. Zezwól na nią w ustawieniach przeglądarki.",
      "location_unavailable": "Nie udało się ustalić lokalizacji. Sprawdź, czy lokalizacja w telefonie jest włączona.",
      "location_inaccurate": "Nie udało się dokładnie ustalić lokalizacji. Wyjdź na otwartą przestrzeń i spróbuj ponownie.",
      "offline": "Brak połączenia. Spróbuj ponownie, gdy złapiesz zasięg — zdjęcie zostało zapamiętane.",
      "unknown": "Coś poszło nie tak. Spróbuj ponownie za chwilę."
    }
  },
  "result": {
    "again": "Zgłoś kolejnego",
    "acceptedTitle": "Brawo! 🐀",
    "gain": "+{{rats}} · +{{raciki}}",
    "rats_one": "{{count}} szczur",
    "rats_few": "{{count}} szczury",
    "rats_many": "{{count}} szczurów",
    "rats_other": "{{count}} szczura",
    "raciki_one": "{{count}} racik",
    "raciki_few": "{{count}} raciki",
    "raciki_many": "{{count}} racików",
    "raciki_other": "{{count}} racika",
    "noPointsTitle": "Ten szczur już zaliczony",
    "noPoints": "Pinezka trafi na mapę, ale punkty za to miejsce już dostałeś. Poszukaj szczura gdzie indziej!",
    "pendingTitle": "Sprawdzamy…",
    "pending": "Nasz szczurzy ekspert jest chwilowo zajęty. Wynik zobaczysz w profilu przy następnym otwarciu aplikacji.",
    "rejectedTitle": "Nie zaliczone",
    "rejected": {
      "no_rat": "Nie widzimy tu szczura. Spróbuj zrobić zdjęcie z trochę bliższej odległości.",
      "screen_or_print": "To wygląda na zdjęcie ekranu albo wydruku — liczą się tylko prawdziwe szczury.",
      "toy_or_drawing": "To chyba zabawka albo rysunek 🙂",
      "verification_failed": "Nie udało się sprawdzić zdjęcia. Zrób nowe zdjęcie."
    },
    "blockedTitle": "Tym razem się nie uda",
    "blocked": {
      "daily_limit": "Dzienny limit zgłoszeń wykorzystany. Wróć jutro 🐀",
      "gps_inaccurate": "Lokalizacja jest zbyt niedokładna. Wyjdź na otwartą przestrzeń i spróbuj ponownie.",
      "outside_city": "Ratlas działa tylko we Wrocławiu.",
      "duplicate": "To zdjęcie już było."
    }
  }
```

- [ ] **Step 2: Napisz testy ekranu**

Utwórz `src/report/ReportScreen.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { LocationError } from './location'
import { ReportScreen } from './ReportScreen'

const mocks = vi.hoisted(() => ({
  capturePhoto: vi.fn(),
  getAccuratePosition: vi.fn(),
  submitSighting: vi.fn(),
  getUserMedia: vi.fn(),
  stop: vi.fn(),
}))

vi.mock('./photo', () => ({ capturePhoto: mocks.capturePhoto }))
vi.mock('./location', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./location')>()),
  getAccuratePosition: mocks.getAccuratePosition,
}))
vi.mock('./reportApi', () => ({ submitSighting: mocks.submitSighting }))

const photo = new Blob(['x'], { type: 'image/jpeg' })
const fix = { lat: 51.11, lon: 17.032, accuracyM: 12 }

beforeEach(() => {
  mocks.getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: mocks.stop }] })
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: mocks.getUserMedia },
    configurable: true,
  })
  mocks.capturePhoto.mockResolvedValue(photo)
  mocks.getAccuratePosition.mockResolvedValue(fix)
})

async function takePhoto() {
  const shutter = await screen.findByRole('button', { name: 'Zrób zdjęcie' })
  await waitFor(() => expect(shutter).toBeEnabled())
  await userEvent.click(shutter)
}

test('zaliczony szczur pokazuje zdobyte szczury i raciki', async () => {
  mocks.submitSighting.mockResolvedValue({ kind: 'recorded', status: 'accepted', rejectReason: null, ratsAwarded: 3, tokensAwarded: 30 })
  const onRecorded = vi.fn()
  render(<ReportScreen onRecorded={onRecorded} />)

  await takePhoto()

  expect(await screen.findByRole('heading', { name: 'Brawo! 🐀' })).toBeInTheDocument()
  expect(screen.getByText('+3 szczury · +30 racików')).toBeInTheDocument()
  expect(mocks.submitSighting).toHaveBeenCalledWith(photo, fix, expect.any(Date))
  expect(onRecorded).toHaveBeenCalled()
  expect(mocks.getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false })
})

test('poza Wrocławiem pokazuje powód i nie odświeża profilu', async () => {
  mocks.submitSighting.mockResolvedValue({ kind: 'blocked', reason: 'outside_city' })
  const onRecorded = vi.fn()
  render(<ReportScreen onRecorded={onRecorded} />)

  await takePhoto()

  expect(await screen.findByText('Ratlas działa tylko we Wrocławiu.')).toBeInTheDocument()
  expect(onRecorded).not.toHaveBeenCalled()
})

test('bez zasięgu można wysłać to samo zdjęcie ponownie', async () => {
  mocks.submitSighting
    .mockResolvedValueOnce({ kind: 'offline' })
    .mockResolvedValueOnce({ kind: 'recorded', status: 'pending', rejectReason: null, ratsAwarded: 0, tokensAwarded: 0 })
  render(<ReportScreen onRecorded={vi.fn()} />)

  await takePhoto()
  await userEvent.click(await screen.findByRole('button', { name: 'Spróbuj ponownie' }))

  expect(await screen.findByRole('heading', { name: 'Sprawdzamy…' })).toBeInTheDocument()
  expect(mocks.submitSighting).toHaveBeenCalledTimes(2)
  expect(mocks.submitSighting.mock.calls[1][0]).toBe(photo)
})

test('odrzucone zdjęcie pokazuje powód', async () => {
  mocks.submitSighting.mockResolvedValue({ kind: 'recorded', status: 'rejected', rejectReason: 'no_rat', ratsAwarded: 0, tokensAwarded: 0 })
  render(<ReportScreen onRecorded={vi.fn()} />)

  await takePhoto()

  expect(await screen.findByText(/Nie widzimy tu szczura/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Zgłoś kolejnego' }))
  expect(await screen.findByRole('button', { name: 'Zrób zdjęcie' })).toBeInTheDocument()
})

test('brak zgody na aparat', async () => {
  mocks.getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
  render(<ReportScreen onRecorded={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Potrzebujemy dostępu do aparatu')
})

test('brak zgody na lokalizację', async () => {
  mocks.getAccuratePosition.mockRejectedValue(new LocationError('denied'))
  render(<ReportScreen onRecorded={vi.fn()} />)

  await takePhoto()

  expect(await screen.findByRole('alert')).toHaveTextContent('Potrzebujemy lokalizacji')
  expect(mocks.submitSighting).not.toHaveBeenCalled()
})

test('przełączenie aparatu zatrzymuje poprzedni i uruchamia przedni', async () => {
  render(<ReportScreen onRecorded={vi.fn()} />)
  await screen.findByRole('button', { name: 'Zrób zdjęcie' })
  await waitFor(() => expect(mocks.getUserMedia).toHaveBeenCalledTimes(1))

  await userEvent.click(screen.getByRole('button', { name: 'Przełącz aparat' }))

  await waitFor(() => expect(mocks.getUserMedia).toHaveBeenLastCalledWith({ video: { facingMode: 'user', width: { ideal: 1920 } }, audio: false }))
  expect(mocks.stop).toHaveBeenCalled()
})
```

Run: `npx vitest run src/report/ReportScreen.test.tsx`
Expected: FAIL — `Failed to resolve import "./ReportScreen"`.

- [ ] **Step 3: Style**

Utwórz `src/report/report.css`:

```css
.report {
  position: relative;
  display: flex;
  flex-direction: column;
  height: calc(100dvh - var(--tabbar-height) - env(safe-area-inset-bottom));
  background: #000;
}

.camera {
  position: relative;
  flex: 1;
  overflow: hidden;
}

.camera__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.camera__shutter {
  position: absolute;
  bottom: 24px;
  left: 50%;
  width: 76px;
  height: 76px;
  transform: translateX(-50%);
  border: 6px solid var(--rose-light);
  border-radius: 50%;
  background: var(--rose);
  cursor: pointer;
}

.camera__shutter:disabled {
  opacity: 0.5;
}

.report__tip {
  position: absolute;
  top: calc(16px + env(safe-area-inset-top));
  left: 16px;
  right: 150px;
  color: #fff;
  font-weight: 700;
  text-shadow: 0 1px 3px rgb(0 0 0 / 0.8);
}

.report__flip {
  position: absolute;
  top: calc(12px + env(safe-area-inset-top));
  right: 12px;
  min-height: 40px;
  padding: 0 14px;
  border-color: transparent;
  background: rgb(0 0 0 / 0.45);
  color: #fff;
}

.report__status {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-weight: 700;
}

.result {
  align-items: center;
  justify-content: center;
  text-align: center;
}

.result__emoji {
  font-size: 64px;
  line-height: 1;
}

.result__gain {
  font-size: 24px;
  font-weight: 800;
  color: var(--rose-dark);
}
```

W `src/main.tsx` dodaj `import './report/report.css'` bezpośrednio po `import './shell/shell.css'`.

- [ ] **Step 4: Podgląd aparatu**

Utwórz `src/report/CameraView.tsx`:

```tsx
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
```

- [ ] **Step 5: Ekran wyniku**

Utwórz `src/report/ResultView.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import type { SubmitOutcome } from './reportApi'

export function ResultView({ outcome, onAgain }: { outcome: SubmitOutcome; onAgain: () => void }) {
  const { t } = useTranslation()

  let emoji = '🐀'
  let title: string
  let text: string

  if (outcome.kind === 'blocked') {
    emoji = '🚫'
    title = t('result.blockedTitle')
    text = t(`result.blocked.${outcome.reason}`)
  } else if (outcome.status === 'accepted') {
    title = t('result.acceptedTitle')
    text = t('result.gain', {
      rats: t('result.rats', { count: outcome.ratsAwarded }),
      raciki: t('result.raciki', { count: outcome.tokensAwarded }),
    })
  } else if (outcome.status === 'accepted_no_points') {
    emoji = '📍'
    title = t('result.noPointsTitle')
    text = t('result.noPoints')
  } else if (outcome.status === 'pending') {
    emoji = '⏳'
    title = t('result.pendingTitle')
    text = t('result.pending')
  } else {
    emoji = '🤔'
    title = t('result.rejectedTitle')
    text = t(`result.rejected.${outcome.rejectReason ?? 'no_rat'}`)
  }

  const isGain = outcome.kind === 'recorded' && outcome.status === 'accepted'

  return (
    <section className="screen stack result">
      <span className="result__emoji" aria-hidden="true">
        {emoji}
      </span>
      <h1>{title}</h1>
      <p className={isGain ? 'result__gain' : undefined}>{text}</p>
      <button className="btn" type="button" onClick={onAgain}>
        {t('result.again')}
      </button>
    </section>
  )
}
```

- [ ] **Step 6: Ekran zgłoszenia**

Utwórz `src/report/ReportScreen.tsx`:

```tsx
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CameraView, type Facing } from './CameraView'
import { getAccuratePosition, GPS_MAX_ACCURACY_M, LocationError, type Fix, type LocationFailure } from './location'
import { submitSighting, type SubmitOutcome } from './reportApi'
import { ResultView } from './ResultView'

type Problem =
  | 'camera_denied'
  | 'location_denied'
  | 'location_unavailable'
  | 'location_inaccurate'
  | 'offline'
  | 'unknown'

interface Shot {
  photo: Blob
  fix: Fix
  capturedAt: Date
}

type State =
  | { kind: 'camera' }
  | { kind: 'working'; step: 'locating' | 'sending' }
  | { kind: 'result'; outcome: SubmitOutcome }
  | { kind: 'problem'; problem: Problem; retry: Shot | null }

const LOCATION_PROBLEMS: Record<LocationFailure, Problem> = {
  denied: 'location_denied',
  unavailable: 'location_unavailable',
  inaccurate: 'location_inaccurate',
}

export function ReportScreen({ onRecorded }: { onRecorded: () => void }) {
  const { t } = useTranslation()
  const [facing, setFacing] = useState<Facing>('environment')
  const [state, setState] = useState<State>({ kind: 'camera' })

  const onDenied = useCallback(() => setState({ kind: 'problem', problem: 'camera_denied', retry: null }), [])

  async function send(shot: Shot) {
    setState({ kind: 'working', step: 'sending' })
    const result = await submitSighting(shot.photo, shot.fix, shot.capturedAt)
    if (result.kind === 'offline' || result.kind === 'error') {
      setState({ kind: 'problem', problem: result.kind === 'offline' ? 'offline' : 'unknown', retry: shot })
      return
    }
    if (result.kind === 'recorded') onRecorded()
    setState({ kind: 'result', outcome: result })
  }

  async function onShot(photo: Blob) {
    const capturedAt = new Date()
    setState({ kind: 'working', step: 'locating' })
    let fix: Fix
    try {
      fix = await getAccuratePosition({ maxAccuracyM: GPS_MAX_ACCURACY_M })
    } catch (error) {
      const problem = error instanceof LocationError ? LOCATION_PROBLEMS[error.failure] : 'unknown'
      setState({ kind: 'problem', problem, retry: null })
      return
    }
    await send({ photo, fix, capturedAt })
  }

  const backToCamera = () => setState({ kind: 'camera' })

  if (state.kind === 'working') {
    return (
      <section className="screen report__status">
        <p role="status">{t(state.step === 'locating' ? 'report.locating' : 'report.sending')}</p>
      </section>
    )
  }

  if (state.kind === 'result') {
    return <ResultView outcome={state.outcome} onAgain={backToCamera} />
  }

  if (state.kind === 'problem') {
    const retry = state.retry
    return (
      <section className="screen stack">
        <p className="error" role="alert">
          {t(`report.problems.${state.problem}`)}
        </p>
        {retry && (
          <button className="btn" type="button" onClick={() => void send(retry)}>
            {t('report.retry')}
          </button>
        )}
        <button className="btn btn--ghost" type="button" onClick={backToCamera}>
          {t('report.back')}
        </button>
      </section>
    )
  }

  return (
    <section className="report">
      <CameraView key={facing} facing={facing} onShot={(photo) => void onShot(photo)} onDenied={onDenied} />
      <p className="report__tip">{t('report.tip')}</p>
      <button
        className="btn btn--ghost report__flip"
        type="button"
        onClick={() => setFacing((current) => (current === 'environment' ? 'user' : 'environment'))}
      >
        {t('report.flip')}
      </button>
    </section>
  )
}
```

- [ ] **Step 7: Podłącz zakładkę „Zgłoś”**

W `src/shell/AppShell.tsx`:
- dodaj import `import { ReportScreen } from '../report/ReportScreen'`
- zamień wyrażenie wybierające ekran w `<main>` na:

```tsx
        {tab === 'profile' ? (
          <ProfileScreen profile={profile} onChange={onProfileChange} />
        ) : tab === 'report' ? (
          <ReportScreen onRecorded={onProfileChange} />
        ) : (
          <ComingSoon title={t(`tabs.${tab}`)} />
        )}
```

- [ ] **Step 8: Uruchom testy, typy i lint**

Run: `npm test && npx tsc -b && npm run lint`
Expected: wszystkie testy przechodzą; bez błędów typów i ostrzeżeń lintera.

- [ ] **Step 9: Commit**

```bash
git add src/report src/i18n/pl.json src/shell/AppShell.tsx src/main.tsx
git commit -m "feat: add report screen with camera, GPS and result view"
```

---

### Task 8: Ranga w profilu i rozstrzyganie zaległych zgłoszeń

**Files:**
- Create: `src/profile/ranksApi.ts`, `src/profile/ranksApi.test.ts`
- Modify: `src/profile/ProfileScreen.tsx`, `src/profile/ProfileScreen.test.tsx`, `src/shell/AppShell.tsx`, `src/App.test.tsx`, `src/i18n/pl.json`, `src/shell/shell.css`

**Interfaces:**
- Consumes: tabela `ranks` (Task 1), `retryPending` (Task 6)
- Produces: `src/profile/ranksApi.ts`: `interface Rank { id: number; name: string; min_rats: number }`, `interface RankProgress { current: Rank; next: Rank | null; remaining: number; fraction: number }`, `fetchRanks(): Promise<Rank[]>`, `rankProgress(totalRats: number, ranks: Rank[]): RankProgress | null`, `useRanks(): Rank[]`

- [ ] **Step 1: Teksty**

W `src/i18n/pl.json` w sekcji `profile` dodaj klucze:

```json
    "rank": "Ranga",
    "toNextRank_one": "Jeszcze {{count}} szczur do rangi „{{rank}}”",
    "toNextRank_few": "Jeszcze {{count}} szczury do rangi „{{rank}}”",
    "toNextRank_many": "Jeszcze {{count}} szczurów do rangi „{{rank}}”",
    "toNextRank_other": "Jeszcze {{count}} szczura do rangi „{{rank}}”",
    "topRank": "Najwyższa ranga — jesteś legendą!"
```

- [ ] **Step 2: Napisz testy rang**

Utwórz `src/profile/ranksApi.test.ts`:

```ts
import { expect, test, vi } from 'vitest'
import { fetchRanks, rankProgress, type Rank } from './ranksApi'

const mocks = vi.hoisted(() => ({ order: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ order: mocks.order }) }) },
}))

const ranks: Rank[] = [
  { id: 2, name: 'Podwórkowy Obserwator', min_rats: 5 },
  { id: 1, name: 'Szczurzy Nowicjusz', min_rats: 0 },
  { id: 3, name: 'Tropiciel z Nadodrza', min_rats: 15 },
]

test('nowicjusz z 0 szczurów', () => {
  expect(rankProgress(0, ranks)).toEqual({ current: ranks[1], next: ranks[0], remaining: 5, fraction: 0 })
})

test('w połowie drogi do kolejnej rangi', () => {
  expect(rankProgress(10, ranks)).toEqual({ current: ranks[0], next: ranks[2], remaining: 5, fraction: 0.5 })
})

test('dokładnie na progu awansuje', () => {
  expect(rankProgress(5, ranks)?.current.name).toBe('Podwórkowy Obserwator')
})

test('najwyższa ranga nie ma następnej', () => {
  expect(rankProgress(99, ranks)).toEqual({ current: ranks[2], next: null, remaining: 0, fraction: 1 })
})

test('bez rang nie ma postępu', () => {
  expect(rankProgress(3, [])).toBeNull()
})

test('pobiera rangi posortowane po progu', async () => {
  mocks.order.mockResolvedValue({ data: ranks, error: null })
  await expect(fetchRanks()).resolves.toBe(ranks)
  expect(mocks.order).toHaveBeenCalledWith('min_rats')
})
```

Run: `npx vitest run src/profile/ranksApi.test.ts`
Expected: FAIL — `Failed to resolve import "./ranksApi"`.

- [ ] **Step 3: Implementacja rang**

Utwórz `src/profile/ranksApi.ts`:

```ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Rank {
  id: number
  name: string
  min_rats: number
}

export interface RankProgress {
  current: Rank
  next: Rank | null
  remaining: number
  fraction: number
}

export async function fetchRanks(): Promise<Rank[]> {
  const { data, error } = await supabase.from('ranks').select('id, name, min_rats').order('min_rats')
  if (error) throw error
  return data as Rank[]
}

export function rankProgress(totalRats: number, ranks: Rank[]): RankProgress | null {
  const sorted = [...ranks].sort((a, b) => a.min_rats - b.min_rats)
  if (sorted.length === 0) return null

  let index = 0
  while (index + 1 < sorted.length && sorted[index + 1].min_rats <= totalRats) index += 1
  const current = sorted[index]
  const next = sorted[index + 1] ?? null
  if (!next) return { current, next: null, remaining: 0, fraction: 1 }

  return {
    current,
    next,
    remaining: next.min_rats - totalRats,
    fraction: (totalRats - current.min_rats) / (next.min_rats - current.min_rats),
  }
}

// Rangi rzadko się zmieniają; gdy nie uda się ich pobrać, profil po prostu ich nie pokazuje.
export function useRanks(): Rank[] {
  const [ranks, setRanks] = useState<Rank[]>([])

  useEffect(() => {
    let cancelled = false
    fetchRanks().then(
      (loaded) => {
        if (!cancelled) setRanks(loaded)
      },
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [])

  return ranks
}
```

Run: `npx vitest run src/profile/ranksApi.test.ts`
Expected: PASS.

- [ ] **Step 4: Test rangi w profilu**

W `src/profile/ProfileScreen.test.tsx`:
- dodaj mock bezpośrednio pod istniejącymi `vi.mock(...)`:

```tsx
vi.mock('./ranksApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ranksApi')>()),
  useRanks: () => [
    { id: 1, name: 'Szczurzy Nowicjusz', min_rats: 0 },
    { id: 2, name: 'Podwórkowy Obserwator', min_rats: 5 },
    { id: 3, name: 'Tropiciel z Nadodrza', min_rats: 15 },
  ],
}))
```

- dopisz na końcu pliku:

```tsx
test('pokazuje rangę i postęp do następnej', () => {
  render(<ProfileScreen profile={makeProfile({ total_rats: 12 })} onChange={vi.fn()} />)
  expect(screen.getByText('Podwórkowy Obserwator')).toBeInTheDocument()
  expect(screen.getByText('Jeszcze 3 szczury do rangi „Tropiciel z Nadodrza”')).toBeInTheDocument()
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '70')
})
```

Run: `npx vitest run src/profile/ProfileScreen.test.tsx`
Expected: FAIL — brak tekstu „Podwórkowy Obserwator”.

- [ ] **Step 5: Ranga w profilu**

W `src/profile/ProfileScreen.tsx`:
- dodaj import: `import { rankProgress, useRanks } from './ranksApi'`
- w ciele komponentu, po istniejących `useState`, dodaj:

```tsx
  const progress = rankProgress(profile.total_rats, useRanks())
```

- bezpośrednio po zamknięciu `<div className="profile__stats">…</div>` wstaw:

```tsx
      {progress && (
        <div className="card stack profile__rank">
          <span className="muted">{t('profile.rank')}</span>
          <strong>{progress.current.name}</strong>
          <div
            className="profile__rank-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.fraction * 100)}
          >
            <div className="profile__rank-fill" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
          </div>
          <span className="muted">
            {progress.next
              ? t('profile.toNextRank', { count: progress.remaining, rank: progress.next.name })
              : t('profile.topRank')}
          </span>
        </div>
      )}
```

Dopisz do `src/shell/shell.css`:

```css
.profile__rank strong {
  font-size: 20px;
  font-weight: 800;
}

.profile__rank-bar {
  height: 10px;
  border-radius: 999px;
  background: var(--fur-light);
  overflow: hidden;
}

.profile__rank-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--rose);
}
```

Run: `npx vitest run src/profile`
Expected: PASS.

- [ ] **Step 6: Rozstrzyganie zaległych przy starcie**

W `src/shell/AppShell.tsx`:
- zmień import Reacta na `import { useEffect, useState } from 'react'`
- dodaj import `import { retryPending } from '../report/reportApi'`
- w ciele komponentu, po `useState`, dodaj:

```tsx
  // Zgłoszenia, których model nie zdążył sprawdzić, rozstrzygamy przy każdym otwarciu aplikacji.
  useEffect(() => {
    let active = true
    void retryPending().then((resolved) => {
      if (active && resolved > 0) onProfileChange()
    })
    return () => {
      active = false
    }
  }, [onProfileChange])
```

W `src/App.test.tsx` dodaj mocki pod istniejącymi `vi.mock(...)`:

```tsx
vi.mock('./report/reportApi', () => ({ retryPending: vi.fn(async () => 0), submitSighting: vi.fn() }))
vi.mock('./profile/ranksApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./profile/ranksApi')>()),
  useRanks: () => [],
}))
```

- [ ] **Step 7: Uruchom testy, typy, lint i build**

Run: `npm test && npx tsc -b && npm run lint && npm run build`
Expected: wszystko przechodzi, bez ostrzeżeń lintera.

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "feat: show rank progress in profile and resolve pending sightings on start"
```

---

### Task 9: Narzędzie oceny modelu i dokumentacja

**Files:**
- Create: `scripts/eval/summary.ts`, `scripts/eval/summary.test.ts`, `scripts/eval-verifier.ts`, `eval/README.md`, `eval/labels.example.csv`
- Modify: `.gitignore`, `docs/deploy.md`, `docs/superpowers/specs/2026-09-29-szczury-wroclaw-design.md`

**Interfaces:**
- Consumes: `createGeminiVerifier`, `DEFAULT_GEMINI_MODEL` (Task 3)
- Produces: `scripts/eval/summary.ts`: `interface EvalCase { file: string; rats: number; screen: boolean; toy: boolean; selfie: boolean }`, `interface Predicted { ratCount: number; isScreenOrPrint: boolean; isToyOrDrawing: boolean; isSelfie: boolean }`, `interface EvalOutcome { evalCase: EvalCase; predicted: Predicted | null }`, `interface EvalSummary { total: number; failed: number; truePositive: number; falsePositive: number; trueNegative: number; falseNegative: number; precision: number; recall: number; exactCount: number; mistakes: string[] }`, `parseLabels(csv: string): EvalCase[]`, `summarize(outcomes: EvalOutcome[]): EvalSummary`

- [ ] **Step 1: Napisz testy podsumowania**

Utwórz `scripts/eval/summary.test.ts`:

```ts
// @vitest-environment node
import { expect, test } from 'vitest'
import { parseLabels, summarize, type EvalCase } from './summary.ts'

test('czyta etykiety z CSV', () => {
  const csv = 'file,rats,screen,toy,selfie\nszczur.jpg,2,0,0,0\nekran.jpg,1,1,0,0\n\n'
  expect(parseLabels(csv)).toEqual([
    { file: 'szczur.jpg', rats: 2, screen: false, toy: false, selfie: false },
    { file: 'ekran.jpg', rats: 1, screen: true, toy: false, selfie: false },
  ])
})

const rat: EvalCase = { file: 'a.jpg', rats: 1, screen: false, toy: false, selfie: false }
const mouse: EvalCase = { file: 'mysz.jpg', rats: 0, screen: false, toy: false, selfie: false }
const screenShot: EvalCase = { file: 'ekran.jpg', rats: 1, screen: true, toy: false, selfie: false }
const ok = (ratCount: number, flags: Partial<{ isScreenOrPrint: boolean; isToyOrDrawing: boolean; isSelfie: boolean }> = {}) => ({
  ratCount,
  isScreenOrPrint: false,
  isToyOrDrawing: false,
  isSelfie: false,
  ...flags,
})

test('liczy precyzję i czułość rozpoznania „prawdziwy szczur”', () => {
  const summary = summarize([
    { evalCase: rat, predicted: ok(1) },
    { evalCase: { ...rat, file: 'b.jpg', rats: 3 }, predicted: ok(2) },
    { evalCase: mouse, predicted: ok(1) },
    { evalCase: screenShot, predicted: ok(1, { isScreenOrPrint: true }) },
    { evalCase: { ...rat, file: 'c.jpg' }, predicted: ok(0) },
    { evalCase: { ...rat, file: 'd.jpg' }, predicted: null },
  ])

  expect(summary).toMatchObject({
    total: 6,
    failed: 1,
    truePositive: 2,
    falsePositive: 1,
    trueNegative: 1,
    falseNegative: 1,
    precision: 2 / 3,
    recall: 2 / 3,
    exactCount: 1,
  })
  expect(summary.mistakes).toEqual([
    'b.jpg: oczekiwano 3 szczurów, model podał 2',
    'mysz.jpg: model uznał za szczura',
    'c.jpg: model nie uznał za szczura',
    'd.jpg: brak odpowiedzi modelu',
  ])
})
```

Run: `npx vitest run scripts`
Expected: FAIL — `Failed to resolve import "./summary.ts"`.

- [ ] **Step 2: Implementacja podsumowania**

Utwórz `scripts/eval/summary.ts`:

```ts
export interface EvalCase {
  file: string
  rats: number
  screen: boolean
  toy: boolean
  selfie: boolean
}

export interface Predicted {
  ratCount: number
  isScreenOrPrint: boolean
  isToyOrDrawing: boolean
  isSelfie: boolean
}

export interface EvalOutcome {
  evalCase: EvalCase
  predicted: Predicted | null
}

export interface EvalSummary {
  total: number
  failed: number
  truePositive: number
  falsePositive: number
  trueNegative: number
  falseNegative: number
  precision: number
  recall: number
  exactCount: number
  mistakes: string[]
}

export function parseLabels(csv: string): EvalCase[] {
  return csv
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const [file, rats, screen, toy, selfie] = line.split(',').map((cell) => cell.trim())
      return { file, rats: Number(rats), screen: screen === '1', toy: toy === '1', selfie: selfie === '1' }
    })
}

// „Prawdziwy szczur” = zdjęcie, które gra powinna zaliczyć (szczur, nie ekran, nie zabawka).
function expectedRealRat(evalCase: EvalCase): boolean {
  return evalCase.rats > 0 && !evalCase.screen && !evalCase.toy
}

function predictedRealRat(predicted: Predicted): boolean {
  return predicted.ratCount > 0 && !predicted.isScreenOrPrint && !predicted.isToyOrDrawing
}

export function summarize(outcomes: EvalOutcome[]): EvalSummary {
  const summary: EvalSummary = {
    total: outcomes.length,
    failed: 0,
    truePositive: 0,
    falsePositive: 0,
    trueNegative: 0,
    falseNegative: 0,
    precision: 0,
    recall: 0,
    exactCount: 0,
    mistakes: [],
  }

  for (const { evalCase, predicted } of outcomes) {
    if (!predicted) {
      summary.failed += 1
      summary.mistakes.push(`${evalCase.file}: brak odpowiedzi modelu`)
      continue
    }
    const expected = expectedRealRat(evalCase)
    const actual = predictedRealRat(predicted)
    if (expected && actual) {
      summary.truePositive += 1
      if (predicted.ratCount === evalCase.rats) summary.exactCount += 1
      else summary.mistakes.push(`${evalCase.file}: oczekiwano ${evalCase.rats} szczurów, model podał ${predicted.ratCount}`)
    } else if (!expected && actual) {
      summary.falsePositive += 1
      summary.mistakes.push(`${evalCase.file}: model uznał za szczura`)
    } else if (expected && !actual) {
      summary.falseNegative += 1
      summary.mistakes.push(`${evalCase.file}: model nie uznał za szczura`)
    } else {
      summary.trueNegative += 1
    }
  }

  const positives = summary.truePositive + summary.falsePositive
  const relevant = summary.truePositive + summary.falseNegative
  summary.precision = positives === 0 ? 0 : summary.truePositive / positives
  summary.recall = relevant === 0 ? 0 : summary.truePositive / relevant
  return summary
}
```

Run: `npx vitest run scripts`
Expected: PASS.

- [ ] **Step 3: Skrypt oceny**

Utwórz `scripts/eval-verifier.ts` (Node 22 uruchamia TypeScript bez kompilacji):

```ts
// Ocena Gemini na własnych zdjęciach. Uruchom:
//   node --env-file=supabase/functions/.env scripts/eval-verifier.ts eval
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createGeminiVerifier, DEFAULT_GEMINI_MODEL } from '../supabase/functions/_shared/geminiVerifier.ts'
import { parseLabels, summarize, type EvalOutcome } from './eval/summary.ts'

const directory = process.argv[2] ?? 'eval'
const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error('Brak GEMINI_API_KEY — wpisz go do supabase/functions/.env')
  process.exit(1)
}

const model = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL
const verifier = createGeminiVerifier({ apiKey, model })
const cases = parseLabels(readFileSync(join(directory, 'labels.csv'), 'utf8'))
const outcomes: EvalOutcome[] = []

console.log(`Model: ${model}, zdjęć: ${cases.length}`)
for (const evalCase of cases) {
  try {
    const predicted = await verifier.verify(new Uint8Array(readFileSync(join(directory, 'photos', evalCase.file))))
    outcomes.push({ evalCase, predicted })
    console.log(`${evalCase.file}: szczury=${predicted.ratCount} ekran=${predicted.isScreenOrPrint} zabawka=${predicted.isToyOrDrawing} selfie=${predicted.isSelfie} tagi=${predicted.tags.join('|')}`)
  } catch (error) {
    outcomes.push({ evalCase, predicted: null })
    console.log(`${evalCase.file}: BŁĄD ${String(error)}`)
  }
  // Darmowy limit zapytań na minutę — nie spieszymy się.
  await new Promise((resolve) => setTimeout(resolve, 4000))
}

const summary = summarize(outcomes)
const percent = (value: number) => `${Math.round(value * 100)}%`
console.log('\n=== Podsumowanie ===')
console.log(`Precyzja „to jest szczur”: ${percent(summary.precision)} (cel ≥ 95%)`)
console.log(`Czułość: ${percent(summary.recall)}`)
console.log(`Dokładna liczba szczurów: ${summary.exactCount}/${summary.truePositive}`)
console.log(`Bez odpowiedzi: ${summary.failed}/${summary.total}`)
if (summary.mistakes.length > 0) console.log(`Pomyłki:\n- ${summary.mistakes.join('\n- ')}`)
```

Utwórz `eval/labels.example.csv`:

```
file,rats,screen,toy,selfie
szczur-smietnik.jpg,1,0,0,0
dwa-szczury.jpg,2,0,0,0
mysz.jpg,0,0,0,0
wiewiorka.jpg,0,0,0,0
szczur-na-ekranie.jpg,1,1,0,0
pluszowy-szczur.jpg,1,0,1,0
selfie-ze-szczurem.jpg,1,0,0,1
```

Utwórz `eval/README.md`:

```markdown
# Zbiór do oceny rozpoznawania szczurów

1. Wrzuć zdjęcia **JPEG** do `eval/photos/` (katalog jest ignorowany przez git — zdjęcia zostają na Twoim dysku).
2. Skopiuj `labels.example.csv` do `labels.csv` i opisz każde zdjęcie:
   - `rats` — ile szczurów naprawdę widać (0 dla myszy, wiewiórek, pustych ulic),
   - `screen` — 1, jeśli to zdjęcie ekranu albo wydruku,
   - `toy` — 1, jeśli to zabawka, rysunek, figurka,
   - `selfie` — 1, jeśli widać twarz fotografującego.
3. Wpisz klucz Gemini do `supabase/functions/.env` (`GEMINI_API_KEY=…`).
4. Uruchom: `npm run eval`

Dobry zbiór startowy: 20–30 zdjęć, w tym „pułapki” (myszy, wiewiórki, chomiki, pluszaki, zdjęcia ekranu). Cel: precyzja „to jest szczur” ≥ 95%.
```

Dopisz do `.gitignore`:

```
eval/photos/
eval/labels.csv
```

- [ ] **Step 4: Instrukcja wdrożenia**

W `docs/deploy.md` wstaw przed sekcją `## Kolejne wdrożenia` nową sekcję:

````markdown
## 8. Zgłoszenia szczurów: funkcje serwerowe i Gemini

1. Klucz Gemini: https://aistudio.google.com → **Get API key** → **Create API key** (darmowy, bez karty). Nie wklejaj go nigdzie poza poniższe miejsca.
2. Lokalnie (testy i ocena modelu): wpisz go do `supabase/functions/.env` jako `GEMINI_API_KEY=…` i usuń linię `VERIFIER=fake`.
3. Na produkcji (w swoim terminalu):
   ```bash
   npx supabase secrets set GEMINI_API_KEY=<klucz> GEMINI_MODEL=gemini-3.5-flash
   npx supabase db push
   npx supabase functions deploy submit-sighting retry-pending
   npm run deploy
   ```
4. **Nigdy** nie ustawiaj `VERIFIER=fake` na produkcji — każde zdjęcie byłoby zaliczane.
````

W sekcji `## Kolejne wdrożenia` zamień pierwszą linię na:

```markdown
`npm run deploy` (po `npx supabase db push`, jeśli doszły migracje, i `npx supabase functions deploy submit-sighting retry-pending`, jeśli zmieniły się funkcje).
```

- [ ] **Step 5: Odstępstwa w specyfikacji**

Na końcu `docs/superpowers/specs/2026-09-29-szczury-wroclaw-design.md` dopisz:

```markdown

## 15. Ustalenia z realizacji planu 2

- Zaległe zgłoszenia (`pending`) rozstrzyga aplikacja przy starcie (funkcja `retry-pending`), a nie `pg_cron` — bez trzymania tajnych kluczy w bazie. Zgłoszenie czeka, aż autor ponownie otworzy aplikację.
- Kolejka offline w IndexedDB odłożona; przy braku zasięgu zdjęcie zostaje w pamięci ekranu z przyciskiem „Spróbuj ponownie”.
- Kasowanie odrzuconych zdjęć po 30 dniach przeniesione do planu 4.
- Dokładność GPS sprawdza także serwer (`gps_max_accuracy_m` = 100 m).
- Weryfikacja: Gemini przez REST `generateContent` (domyślnie `gemini-3.5-flash`, zmienny sekretem `GEMINI_MODEL`); lokalnie `VERIFIER=fake`.
```

- [ ] **Step 6: Uruchom testy**

Run: `npm test && npx tsc -b`
Expected: wszystko przechodzi.

- [ ] **Step 7: Commit**

```bash
git add scripts eval .gitignore docs
git commit -m "feat: add verifier evaluation tool; document Gemini setup and plan 2 decisions"
```

---

### Task 10: Uruchomienie z prawdziwym Gemini i na produkcji (z udziałem właściciela)

Ten task wymaga klucza Gemini i dostępu do kont — agent przygotowuje i sprawdza, właściciel wykonuje kroki z sekretami i hasłami w swoim terminalu.

**Files:** brak nowych (ewentualnie `DEFAULT_GEMINI_MODEL` w `supabase/functions/_shared/geminiVerifier.ts`, jeśli ocena wskaże inny model)

- [ ] **Step 1: Klucz lokalnie**

Właściciel tworzy klucz (docs/deploy.md §8 pkt 1) i wpisuje go do `supabase/functions/.env` (`GEMINI_API_KEY=…`, bez `VERIFIER=fake`). Agent sprawdza tylko, że linia istnieje: `grep -c "^GEMINI_API_KEY=." supabase/functions/.env` → `1` (nie wypisuje klucza).

- [ ] **Step 2: Test prawdziwego modelu**

Właściciel wrzuca 5–30 zdjęć do `eval/photos/` i opisuje je w `eval/labels.csv` (eval/README.md). Run: `npm run eval`
Expected: odpowiedź dla każdego zdjęcia (bez `BŁĄD HTTP 400/404` — te oznaczają zły format zapytania albo nazwę modelu; wtedy popraw `geminiVerifier.ts` lub `GEMINI_MODEL` według komunikatu). Zapisz wynik precyzji w raporcie. Jeśli precyzja < 95%, porównaj z `GEMINI_MODEL` ustawionym na inny darmowy model Flash i wybierz lepszy.

- [ ] **Step 3: Pełny przepływ lokalnie z Gemini**

`npm run functions:serve` + `npm run dev`, zaloguj się (Mailpit), zakładka „Zgłoś”, zrób zdjęcie szczura z ekranu komputera — oczekiwany wynik: „Nie zaliczone — zdjęcie ekranu” (w przeglądarce na komputerze lokalizacja może być niedokładna; wtedy wynik „Lokalizacja jest zbyt niedokładna” też jest poprawny).

- [ ] **Step 4: Produkcja**

Właściciel w swoim terminalu: `npx supabase secrets set GEMINI_API_KEY=<klucz> GEMINI_MODEL=<wybrany model>` i `npx supabase db push`. Agent: `npx supabase functions deploy submit-sighting retry-pending` i `npm run deploy`, potem sprawdzenie, że `https://vbarjfzxlfsayqwewdrt.supabase.co/functions/v1/submit-sighting` bez tokenu zwraca błąd uwierzytelnienia (a nie 404).

- [ ] **Step 5: Test na telefonie**

Właściciel: zainstalowana aplikacja → „Zgłoś” → zgoda na aparat i lokalizację → zdjęcie (np. szczura na ekranie drugiego urządzenia — powinno być odrzucone jako ekran; prawdziwy szczur — zaliczony) → wynik → Profil pokazuje liczniki i rangę.
