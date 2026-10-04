# Plan 4: Grywalizacja i porządki — implementacja

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ratlas dostaje osiągnięcia (jawne i ukryte, z racikami za odblokowanie), ranking miesięczny i ogólny, zmianę pseudonimu i usuwanie konta z poziomu aplikacji; do tego limity zgłoszeń nadużyć, sprzątanie starych odrzuconych zdjęć i testy E2E w prawdziwej przeglądarce.

**Architecture:** Osiągnięcia są danymi w tabeli `achievements` (reguła w JSON), oceniane w SQL w tej samej transakcji co naliczenie punktów (`apply_verification` → `evaluate_achievements`); użytkownik widzi je przez `my_achievements()`, która ukrywa nazwy nieodkrytych sekretów. Ranking liczy funkcja `get_ranking(period)` na bieżąco (bez widoków zmaterializowanych). Usuwanie konta to Edge Function `delete-account` (zdjęcia ze Storage + `auth.admin.deleteUser`, reszta kaskadą). Testy E2E: Playwright 1.63 z Chromium w trybie telefonu, przeciw lokalnemu Supabase.

**Tech Stack:** jak w planach 1–3 + `@playwright/test@1.63.0` (przeglądarka Chromium 1243 jest już w pamięci podręcznej komputera).

**Spec:** [docs/superpowers/specs/2026-09-29-szczury-wroclaw-design.md](../specs/2026-09-29-szczury-wroclaw-design.md) — sekcje 5 (`achievements`, `user_achievements`, ranking), 6 (rangi, osiągnięcia, ranking), 11 (usuwanie konta), 12 (E2E), 15–16

**Poprzednie plany:** [plan 1](2026-09-30-plan-1-fundament.md), [plan 2](2026-10-01-plan-2-zgloszenia.md), [plan 3](2026-10-01-plan-3-mapa.md) — zrealizowane; kod w repozytorium jest źródłem prawdy.

## Odstępstwa i decyzje (plan 4)

1. **Ranking liczony na bieżąco** funkcją `get_ranking` zamiast zmaterializowanych widoków z `pg_cron` — przy obecnej skali to szybkie i prostsze; do zmiany, gdyby zaczęło zwalniać.
2. **„Odrzański Wilk”** przyznawany tylko po tagu `woda` (bez geometrii Odry).
3. **Zmiana pseudonimu** dozwolona w każdej chwili (unikalność i format pilnuje baza).
4. **Sprzątanie odrzuconych zdjęć po 30 dniach** wykonuje `retry-pending` przy otwarciu aplikacji (zdjęcia tej osoby), a nie zadanie cykliczne.
5. **Zgłaszanie nadużyć**: tylko osoby z co najmniej jednym zaliczonym szczurem i maks. 10 zgłoszeń na dobę (ogranicza ukrywanie cudzych pinezek z jednorazowych kont).
6. Komunikaty osiągnięć są neutralne płciowo („Sekretne osiągnięcie odkryte: …”).

## Global Constraints

- Nazwa: **Ratlas**; waluta w interfejsie: **raciki** (1 racik, 2 raciki, 5 racików); w kodzie i bazie `tokens*`.
- Każdy widoczny tekst z `src/i18n/pl.json` (liczba mnoga `_one/_few/_many/_other`); teksty neutralne płciowo.
- **Produkcja ma wyłączone „Automatically expose new tables”** — każda nowa tabela/funkcja: jawne `revoke`/`grant` + test pgTAP uprawnień.
- Punkty, raciki i osiągnięcia zmieniają wyłącznie funkcje SQL `security definer` (`search_path = ''`); użytkownik nie ma prawa zapisu do tych tabel.
- Osiągnięcia przyznajemy tylko zgłoszeniom o statusie `accepted` (nie `accepted_no_points`, nie `rejected`).
- Nazwy, opisy i kody **nieodkrytych sekretnych** osiągnięć nie mogą trafić do aplikacji.
- Ranking: zakładki miesiąc (czas polski) i od początku; wartość = suma `rats_awarded` zaliczonych zgłoszeń; top 50 + pozycja zalogowanej osoby; remis — wyżej ten, kto osiągnął wynik wcześniej; tylko osoby po onboardingu.
- Usunięcie konta kasuje: konto auth, profil, zgłoszenia, dziennik racików, zgłoszenia nadużyć, osiągnięcia oraz wszystkie zdjęcia tej osoby w Storage.
- Lokalny Supabase: tylko `npm run db:start` / `db:reset` / `test:db`; funkcje lokalnie `npm run functions:serve`.
- TypeScript: `import type`, bez `enum`, bez parameter properties.
- Commity: `git -c user.email=michalpla05@gmail.com -c user.name=placik commit …`, stopka `Co-Authored-By:` z nazwą modelu.

## Struktura plików

```
supabase/migrations/20261004000000_achievements.sql
supabase/migrations/20261004000100_social.sql          # ranking, pseudonim, limity nadużyć, sprzątanie zdjęć
supabase/tests/achievements.test.sql
supabase/tests/social.test.sql
supabase/tests/sightings.test.sql, supabase/tests/map.test.sql   # aktualizacja
supabase/functions/_shared/storageCleanup.ts (+ .test.ts)
supabase/functions/delete-account/{index.ts,deno.json}
supabase/functions/retry-pending/index.ts                # + sprzątanie zdjęć
scripts/smoke-sighting.mjs                               # + osiągnięcie, usunięcie konta
src/profile/achievementsApi.ts (+ .test.ts), src/profile/Achievements.tsx (+ .test.tsx)
src/ranking/rankingApi.ts (+ .test.ts), src/ranking/RankingScreen.tsx (+ .test.tsx), src/ranking/ranking.css
src/profile/NicknameEditor.tsx (+ .test.tsx), src/profile/accountApi.ts, src/profile/DeleteAccount.tsx (+ .test.tsx)
src/report/reportApi.ts, src/report/ResultView.tsx (+ testy), src/map/mapApi.ts, src/profile/mySightingsApi.ts, src/legal/*
playwright.config.ts, tests/e2e/helpers.ts, tests/e2e/app.spec.ts
```

---

### Task 1: Osiągnięcia w bazie

**Files:**
- Create: `supabase/migrations/20261004000000_achievements.sql`, `supabase/tests/achievements.test.sql`
- Modify: `supabase/tests/sightings.test.sql` (izolacja od osiągnięć)

**Interfaces:**
- Consumes: `sightings`, `profiles`, `token_ledger` (reason `'achievement'` jest dozwolony), `apply_verification`, `sighting_result`, `record_sighting`, `resolve_pending`, `config_int` (plan 2)
- Produces:
  - tabele `public.achievements(code, name, description, secret, reward_tokens, rule, sort_order)` i `public.user_achievements(user_id, achievement_code, sighting_id, unlocked_at)` — bez dostępu przez API
  - `public.achievement_rule_matches(p_rule jsonb, p_sighting public.sightings, p_total_rats integer) returns boolean` (wewnętrzna)
  - `public.evaluate_achievements(p_sighting_id uuid) returns void` (wewnętrzna; przyznaje osiągnięcia i raciki)
  - `apply_verification` (ta sama sygnatura) wywołuje `evaluate_achievements` dla `accepted`
  - `sighting_result(p_id)` zwraca dodatkowo `"achievements": [{"code","name","secret","reward_tokens"}]` — odblokowane przez to zgłoszenie, w kolejności `sort_order`
  - `public.my_achievements() returns table(sort_order smallint, code text, name text, description text, secret boolean, reward_tokens integer, unlocked_at timestamptz)` — execute tylko `authenticated`; dla nieodkrytych sekretów `code`, `name`, `description`, `reward_tokens` = null

- [ ] **Step 1: Napisz testy bazy**

Utwórz `supabase/tests/achievements.test.sql`:

```sql
begin;
select plan(16);

delete from public.reports;
delete from public.sightings;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ala@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ola@example.com');

create temporary table v (name text primary key, value jsonb);
insert into v values
  ('one', '{"ratCount":1,"isSelfie":false,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":[],"raw":{}}'),
  ('trash', '{"ratCount":1,"isSelfie":false,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":["smietnik"],"raw":{}}'),
  ('selfie', '{"ratCount":1,"isSelfie":true,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":[],"raw":{}}'),
  ('seven', '{"ratCount":7,"isSelfie":false,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":[],"raw":{}}'),
  ('none_dwarf', '{"ratCount":0,"isSelfie":false,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":["krasnal"],"raw":{}}'),
  ('rain', '{"ratCount":1,"isSelfie":false,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":["deszcz"],"raw":{}}');

-- Pomocnik: kody osiągnięć z wyniku zgłoszenia.
create function pg_temp.codes(p_result jsonb) returns text[] language sql as $$
  select coalesce(array_agg(a ->> 'code' order by ordinality), '{}') from jsonb_array_elements(p_result -> 'achievements') with ordinality as a
$$;

-- 1
select is(
  (select row(count(*), count(*) filter (where secret))::text from public.achievements),
  row(13, 7)::text,
  '13 osiągnięć, w tym 7 sekretnych'
);

-- 2–4: pierwszy szczur
select is(
  pg_temp.codes(public.record_sighting('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
    17.0320, 51.1100, 10, now(), 'map-photos', 'a1.jpg', '0000000000000001', 'fake', (select value from v where name = 'one'))),
  array['first_rat'],
  'pierwszy zaliczony szczur odblokowuje „Pierwszy szczur”'
);
select is(
  (select row(total_rats, tokens_balance)::text from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  row(1, 35)::text,
  'raciki: 10 za szczura + 25 za osiągnięcie'
);
select is(
  (select row(delta, reason)::text from public.token_ledger where ref_id = 'a0000000-0000-0000-0000-000000000001' and reason = 'achievement'),
  row(25, 'achievement')::text,
  'nagroda za osiągnięcie jest w dzienniku racików'
);

-- 5–6: sekret za tag i brak powtórki
select is(
  pg_temp.codes(public.record_sighting('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
    17.0590, 51.1110, 10, now(), 'map-photos', 'a2.jpg', '0000000000000002', 'fake', (select value from v where name = 'trash'))),
  array['trash_gourmet'],
  'tag „smietnik” odblokowuje sekretnego Śmietnikowego Smakosza'
);
select is(
  pg_temp.codes(public.record_sighting('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
    17.0460, 51.1140, 10, now(), 'map-photos', 'a3.jpg', '0000000000000003', 'fake', (select value from v where name = 'trash'))),
  '{}'::text[],
  'raz odblokowane osiągnięcie nie wraca'
);

-- 7–8: selfie i gniazdo
select is(
  pg_temp.codes(public.record_sighting('a0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
    17.0300, 51.1230, 10, now(), 'sightings-private', '1111/a4.jpg', '0000000000000004', 'fake', (select value from v where name = 'selfie'))),
  array['selfie'],
  'selfie odblokowuje Szczurze Selfie'
);
select is(
  pg_temp.codes(public.record_sighting('a0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111',
    17.0200, 51.0800, 10, now(), 'map-photos', 'a5.jpg', '0000000000000005', 'fake', (select value from v where name = 'seven'))),
  array['nest'],
  '5 zaliczonych szczurów na zdjęciu to Gniazdo'
);

-- 9–10: nocne zgłoszenie rozstrzygnięte później + Dziesiątka
do $$
begin
  perform public.record_sighting('a0000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111',
    17.1000, 51.1050, 10, now(), 'sightings-private', '1111/a6.jpg', '0000000000000006', 'gemini', null);
end;
$$;
update public.sightings
   set created_at = (date_trunc('day', now() at time zone 'Europe/Warsaw') - interval '1 day' + interval '2 hours') at time zone 'Europe/Warsaw'
 where id = 'a0000000-0000-0000-0000-000000000006';
select is(
  pg_temp.codes(public.resolve_pending('a0000000-0000-0000-0000-000000000006', 'map-photos', 'a6.jpg', 'gemini',
    (select value from v where name = 'one'))),
  array['rats_10', 'night_owl'],
  'zgłoszenie z 2:00 to Nocny Marek, a 10. szczur to Dziesiątka'
);
select is(
  (select row(total_rats, tokens_balance)::text from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  row(10, 430)::text,
  'suma: 100 racików za szczury + 330 za osiągnięcia'
);

-- 11–12: odrzucone i bez punktów nie dają osiągnięć
select is(
  pg_temp.codes(public.record_sighting('a0000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111',
    16.8700, 51.1450, 10, now(), 'sightings-private', '1111/a7.jpg', '0000000000000007', 'fake', (select value from v where name = 'none_dwarf'))),
  '{}'::text[],
  'odrzucone zgłoszenie z krasnalem nic nie odblokowuje'
);
select is(
  (select row(r ->> 'status', pg_temp.codes(r))::text
     from (select public.record_sighting('a0000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111',
       17.0322, 51.1101, 10, now(), 'map-photos', 'a8.jpg', '0000000000000008', 'fake', (select value from v where name = 'rain')) as r) as x),
  row('accepted_no_points', '{}'::text[])::text,
  'zgłoszenie bez punktów (cooldown) nie odblokowuje Mokrego Futrzaka'
);

-- 13: seria 7 dni (użytkownik 2)
do $$
declare
  i integer;
begin
  for i in 1..6 loop
    perform public.record_sighting(('b0000000-0000-0000-0000-00000000000' || i)::uuid, '22222222-2222-2222-2222-222222222222',
      17.00 + i * 0.01, 51.11, 10, now(), 'map-photos', 'b' || i || '.jpg', lpad(to_hex(100 + i), 16, '0'), 'fake',
      (select value from v where name = 'one'));
    update public.sightings set created_at = now() - make_interval(days => 7 - i)
     where id = ('b0000000-0000-0000-0000-00000000000' || i)::uuid;
  end loop;
end;
$$;
select ok(
  'streak_7' = any (pg_temp.codes(public.record_sighting('b0000000-0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222',
    16.95, 51.12, 10, now(), 'map-photos', 'b7.jpg', '00000000000000ff', 'fake', (select value from v where name = 'one')))),
  'szczur 7 dni z rzędu to Seria'
);

-- 14–15: widok osiągnięć użytkownika nie zdradza sekretów
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select is(
  (select row(count(*), count(*) filter (where code is null), count(*) filter (where unlocked_at is not null))::text
     from public.my_achievements()),
  row(13, 4, 6)::text,
  '13 osiągnięć: 4 nieodkryte sekrety bez kodu, 6 odblokowanych'
);
select is(
  (select row(code, name, description, reward_tokens)::text from public.my_achievements() where sort_order = 10),
  row(null::text, null::text, null::text, null::integer)::text,
  'nieodkryty Szczur i Krasnal nie zdradza nazwy, opisu ani nagrody'
);

-- 16: uprawnienia
reset role;
select ok(
  has_function_privilege('authenticated', 'public.my_achievements()', 'execute')
  and not has_function_privilege('anon', 'public.my_achievements()', 'execute')
  and not has_function_privilege('authenticated', 'public.evaluate_achievements(uuid)', 'execute')
  and not has_table_privilege('authenticated', 'public.achievements', 'select')
  and not has_table_privilege('authenticated', 'public.user_achievements', 'select'),
  'osiągnięcia widać tylko przez my_achievements()'
);

select * from finish();
rollback;
```

W `supabase/tests/sightings.test.sql` zaraz po linii `select plan(…);` dodaj (w wycofywanej transakcji — testy punktów sprawdzają raciki bez nagród za osiągnięcia):

```sql
delete from public.achievements;
```

- [ ] **Step 2: Uruchom testy i sprawdź, że nie przechodzą**

Run: `npm run test:db`
Expected: FAIL w `achievements.test.sql` (brak tabeli `public.achievements`); `sightings.test.sql` też padnie na nowym `delete` — to oczekiwane do czasu migracji.

- [ ] **Step 3: Migracja**

Utwórz `supabase/migrations/20261004000000_achievements.sql`:

```sql
-- Osiągnięcia: jawne i ukryte, przyznawane przy zaliczonym zgłoszeniu w tej samej transakcji co punkty.
-- Produkcja ma wyłączone automatyczne udostępnianie — uprawnienia nadajemy jawnie.

create table public.achievements (
  code text primary key,
  name text not null,
  description text not null,
  secret boolean not null default false,
  reward_tokens integer not null check (reward_tokens >= 0),
  rule jsonb not null,
  sort_order smallint not null unique
);

alter table public.achievements enable row level security;
revoke all on public.achievements from anon, authenticated;

insert into public.achievements (code, name, description, secret, reward_tokens, rule, sort_order) values
  ('first_rat', 'Pierwszy szczur', 'Zalicz swojego pierwszego szczura.', false, 25, '{"type":"total_rats_gte","value":1}', 1),
  ('rats_10', 'Dziesiątka', 'Zalicz 10 szczurów.', false, 30, '{"type":"total_rats_gte","value":10}', 2),
  ('rats_50', 'Pół setki', 'Zalicz 50 szczurów.', false, 40, '{"type":"total_rats_gte","value":50}', 3),
  ('rats_100', 'Setka', 'Zalicz 100 szczurów.', false, 50, '{"type":"total_rats_gte","value":100}', 4),
  ('nest', 'Gniazdo', 'Zalicz 5 szczurów na jednym zdjęciu.', false, 50, '{"type":"rats_in_photo_gte","value":5}', 5),
  ('streak_7', 'Seria', 'Zaliczaj szczura 7 dni z rzędu.', false, 50, '{"type":"streak_days_gte","value":7}', 6),
  ('selfie', 'Szczurze Selfie', 'Zrób sobie selfie ze szczurem.', true, 75, '{"type":"selfie"}', 7),
  ('night_owl', 'Nocny Marek', 'Wypatrz szczura między północą a 4:00.', true, 75, '{"type":"hour_between","from":0,"to":4}', 8),
  ('trash_gourmet', 'Śmietnikowy Smakosz', 'Przyłap szczura przy śmietniku.', true, 75, '{"type":"tag","value":"smietnik"}', 9),
  ('dwarf_friend', 'Szczur i Krasnal', 'Sfotografuj szczura przy wrocławskim krasnalu.', true, 100, '{"type":"tag","value":"krasnal"}', 10),
  ('odra_wolf', 'Odrzański Wilk', 'Wypatrz szczura nad wodą.', true, 75, '{"type":"tag","value":"woda"}', 11),
  ('mpk_passenger', 'Pasażer MPK', 'Spotkaj szczura przy tramwaju albo przystanku.', true, 75, '{"type":"tag","value":"tramwaj_przystanek"}', 12),
  ('wet_fur', 'Mokry Futrzak', 'Znajdź szczura w deszczu.', true, 75, '{"type":"tag","value":"deszcz"}', 13);

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_code text not null references public.achievements (code) on delete cascade,
  sighting_id uuid references public.sightings (id) on delete set null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_code)
);

create index user_achievements_sighting_idx on public.user_achievements (sighting_id);

alter table public.user_achievements enable row level security;
revoke all on public.user_achievements from anon, authenticated;

create function public.achievement_rule_matches(p_rule jsonb, p_sighting public.sightings, p_total_rats integer)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hour integer := extract(hour from p_sighting.created_at at time zone 'Europe/Warsaw');
  v_day date := (p_sighting.created_at at time zone 'Europe/Warsaw')::date;
  v_days integer;
begin
  case p_rule ->> 'type'
    when 'total_rats_gte' then
      return p_total_rats >= (p_rule ->> 'value')::integer;
    when 'rats_in_photo_gte' then
      return p_sighting.rats_awarded >= (p_rule ->> 'value')::integer;
    when 'selfie' then
      return p_sighting.is_selfie;
    when 'tag' then
      return (p_rule ->> 'value') = any (p_sighting.tags);
    when 'hour_between' then
      return v_hour >= (p_rule ->> 'from')::integer and v_hour < (p_rule ->> 'to')::integer;
    when 'streak_days_gte' then
      select count(distinct (o.created_at at time zone 'Europe/Warsaw')::date) into v_days
        from public.sightings o
       where o.user_id = p_sighting.user_id
         and o.status = 'accepted'
         and (o.created_at at time zone 'Europe/Warsaw')::date
             between v_day - ((p_rule ->> 'value')::integer - 1) and v_day;
      return v_days >= (p_rule ->> 'value')::integer;
    else
      return false;
  end case;
end;
$$;

create function public.evaluate_achievements(p_sighting_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.sightings;
  v_total integer;
  a public.achievements;
  v_reward integer := 0;
begin
  select * into s from public.sightings where id = p_sighting_id;
  if s.id is null or s.status <> 'accepted' then
    return;
  end if;
  select total_rats into v_total from public.profiles where id = s.user_id;

  for a in select * from public.achievements order by sort_order loop
    continue when exists (
      select 1 from public.user_achievements ua where ua.user_id = s.user_id and ua.achievement_code = a.code
    );
    continue when not public.achievement_rule_matches(a.rule, s, v_total);

    insert into public.user_achievements (user_id, achievement_code, sighting_id) values (s.user_id, a.code, s.id);
    if a.reward_tokens > 0 then
      insert into public.token_ledger (user_id, delta, reason, ref_id) values (s.user_id, a.reward_tokens, 'achievement', s.id);
      v_reward := v_reward + a.reward_tokens;
    end if;
  end loop;

  if v_reward > 0 then
    update public.profiles set tokens_balance = tokens_balance + v_reward where id = s.user_id;
  end if;
end;
$$;

-- Ta sama logika co w planie 2 (dwustronny cooldown, fail closed), plus osiągnięcia dla zaliczonych zgłoszeń.
create or replace function public.apply_verification(p_id uuid, p_verification jsonb, p_verifier text)
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
  -- Fail closed: niekompletna odpowiedź weryfikatora nigdy nie zalicza zgłoszenia.
  if p_verification is null
     or p_verification ->> 'ratCount' is null
     or p_verification ->> 'isSelfie' is null
     or p_verification ->> 'isScreenOrPrint' is null
     or p_verification ->> 'isToyOrDrawing' is null
     or p_verification ->> 'hasThirdPartyFaces' is null then
    raise exception 'invalid verification' using errcode = '22023';
  end if;

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
       and o.created_at between s.created_at - make_interval(mins => public.config_int('cooldown_minutes'))
                            and s.created_at + make_interval(mins => public.config_int('cooldown_minutes'))
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

    perform public.evaluate_achievements(p_id);
  end if;
end;
$$;

create or replace function public.sighting_result(p_id uuid)
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
    'tokens_balance', p.tokens_balance,
    'achievements', coalesce((
      select jsonb_agg(
               jsonb_build_object('code', a.code, 'name', a.name, 'secret', a.secret, 'reward_tokens', a.reward_tokens)
               order by a.sort_order)
        from public.user_achievements ua
        join public.achievements a on a.code = ua.achievement_code
       where ua.sighting_id = s.id
    ), '[]'::jsonb)
  )
  from public.sightings s
  join public.profiles p on p.id = s.user_id
  where s.id = p_id
$$;

create function public.my_achievements()
returns table (
  sort_order smallint,
  code text,
  name text,
  description text,
  secret boolean,
  reward_tokens integer,
  unlocked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Nieodkryte sekrety nie zdradzają kodu, nazwy, opisu ani nagrody.
  select a.sort_order,
         case when not a.secret or ua.unlocked_at is not null then a.code end,
         case when not a.secret or ua.unlocked_at is not null then a.name end,
         case when not a.secret or ua.unlocked_at is not null then a.description end,
         a.secret,
         case when not a.secret or ua.unlocked_at is not null then a.reward_tokens end,
         ua.unlocked_at
    from public.achievements a
    left join public.user_achievements ua
      on ua.achievement_code = a.code and ua.user_id = (select auth.uid())
   order by a.sort_order
$$;

revoke execute on function public.achievement_rule_matches(jsonb, public.sightings, integer) from public, anon, authenticated;
revoke execute on function public.evaluate_achievements(uuid) from public, anon, authenticated;
revoke execute on function public.my_achievements() from public, anon, authenticated;
grant execute on function public.my_achievements() to authenticated;
```

- [ ] **Step 4: Zastosuj migrację i uruchom testy**

Run: `npm run db:reset && npm run test:db`
Expected: wszystkie pliki `ok`, `Result: PASS` (achievements.test.sql: 16).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261004000000_achievements.sql supabase/tests/achievements.test.sql supabase/tests/sightings.test.sql
git commit -m "feat: add achievements awarded with sightings"
```

---

### Task 2: Ranking, zmiana pseudonimu, limity nadużyć, sprzątanie zdjęć (baza)

**Files:**
- Create: `supabase/migrations/20261004000100_social.sql`, `supabase/tests/social.test.sql`
- Modify: `supabase/tests/map.test.sql`

**Interfaces:**
- Consumes: `sightings`, `profiles`, `reports`, `report_sighting` (plan 3), `warsaw_day_start`, `config_int`
- Produces:
  - klucze `app_config`: `daily_report_limit` = 10, `rejected_photo_retention_days` = 30
  - kolumna `sightings.photo_deleted_at timestamptz` (null = zdjęcie istnieje)
  - `grant select on public.sightings to service_role`
  - `public.get_ranking(p_period text) returns table(place bigint, nickname text, rats bigint, is_me boolean)` — `p_period` `'month'` | `'all'` (inna wartość → 0 wierszy); execute `authenticated`
  - `public.change_nickname(p_nickname text) returns void` — błędy `23505` zajęty, `23514` zły format/null, `P0001` przed onboardingiem, `28000` niezalogowany; execute `authenticated`
  - `report_sighting` (ta sama sygnatura) może zwrócić też `'not_allowed'` (brak zaliczonego szczura) i `'limit'` (dzienny limit)
  - `public.list_expired_rejected_photos(p_user_id uuid) returns table(id uuid, photo_bucket text, photo_path text)` (maks. 20), `public.mark_photos_deleted(p_user_id uuid, p_ids uuid[]) returns integer`, `public.list_my_photo_paths(p_user_id uuid) returns table(photo_bucket text, photo_path text)` — execute tylko `service_role`

- [ ] **Step 1: Napisz testy bazy**

Utwórz `supabase/tests/social.test.sql`:

```sql
begin;
select plan(14);

delete from public.reports;
delete from public.sightings;
delete from public.achievements;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ala@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ola@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'bez@example.com');

update public.profiles set nickname = 'Ala', terms_accepted_at = now(), age_confirmed = true
 where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set nickname = 'Ola', terms_accepted_at = now(), age_confirmed = true
 where id = '22222222-2222-2222-2222-222222222222';

create temporary table v (name text primary key, value jsonb);
insert into v values
  ('three', '{"ratCount":3,"isSelfie":false,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":[],"raw":{}}'),
  ('five', '{"ratCount":5,"isSelfie":false,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":[],"raw":{}}'),
  ('none', '{"ratCount":0,"isSelfie":false,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":[],"raw":{}}');

-- Ala: 3 szczury w tym miesiącu (wcześniej); Ola: 3 w tym miesiącu (później) + 5 w poprzednim; 3: bez onboardingu.
do $$
begin
  perform public.record_sighting('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
    17.0320, 51.1100, 10, now(), 'map-photos', 'c1.jpg', '1000000000000001', 'fake', (select value from v where name = 'three'));
  perform public.record_sighting('c0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
    17.0590, 51.1110, 10, now(), 'map-photos', 'c2.jpg', '1000000000000002', 'fake', (select value from v where name = 'three'));
  perform public.record_sighting('c0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222',
    17.0460, 51.1140, 10, now(), 'map-photos', 'c3.jpg', '1000000000000003', 'fake', (select value from v where name = 'five'));
  perform public.record_sighting('c0000000-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333',
    17.0300, 51.1230, 10, now(), 'map-photos', 'c4.jpg', '1000000000000004', 'fake', (select value from v where name = 'five'));
  -- Odrzucone zdjęcia Ali: stare (31 dni) i świeże (10 dni).
  perform public.record_sighting('c0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111',
    17.0200, 51.0800, 10, now(), 'sightings-private', '1111/c5.jpg', '1000000000000005', 'fake', (select value from v where name = 'none'));
  perform public.record_sighting('c0000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111',
    17.1000, 51.1050, 10, now(), 'sightings-private', '1111/c6.jpg', '1000000000000006', 'fake', (select value from v where name = 'none'));
end;
$$;
update public.sightings set created_at = now() - interval '2 minutes' where id = 'c0000000-0000-0000-0000-000000000001';
update public.sightings set created_at = date_trunc('month', now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw' - interval '3 days'
 where id = 'c0000000-0000-0000-0000-000000000003';
update public.sightings set created_at = now() - interval '31 days' where id = 'c0000000-0000-0000-0000-000000000005';
update public.sightings set created_at = now() - interval '10 days' where id = 'c0000000-0000-0000-0000-000000000006';

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- 1–4: ranking
select is(
  (select array_agg(nickname order by place) from public.get_ranking('month')),
  array['Ala', 'Ola'],
  'w tym miesiącu remis 3:3 — wyżej Ala, bo osiągnęła wynik wcześniej; osoba bez onboardingu pominięta'
);
select is(
  (select array_agg(row(nickname, rats)::text order by place) from public.get_ranking('all')),
  array[row('Ola', 8)::text, row('Ala', 3)::text],
  'od początku: Ola 8, Ala 3'
);
select is(
  (select array_agg(is_me order by place) from public.get_ranking('all')),
  array[false, true],
  'ranking oznacza zalogowaną osobę'
);
select is((select count(*)::int from public.get_ranking('rok')), 0, 'nieznany okres zwraca pusty ranking');

-- 5–9: zmiana pseudonimu
select lives_ok($$ select public.change_nickname('Szczurek') $$, 'zmiana pseudonimu');
select is((select nickname from public.get_ranking('all') where is_me), 'Szczurek', 'ranking pokazuje nowy pseudonim');
select throws_ok($$ select public.change_nickname('ola') $$, '23505', null, 'zajęty pseudonim (bez względu na wielkość liter)');
select throws_ok($$ select public.change_nickname('a b') $$, '23514', null, 'zły format pseudonimu');
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select throws_ok($$ select public.change_nickname('Nowy') $$, 'P0001', 'not onboarded', 'przed onboardingiem nie zmienisz pseudonimu');

-- 10–13: sprzątanie zdjęć (wywołuje service_role)
reset role;
select is(
  (select array_agg(id) from public.list_expired_rejected_photos('11111111-1111-1111-1111-111111111111')),
  array['c0000000-0000-0000-0000-000000000005']::uuid[],
  'tylko odrzucone zdjęcia starsze niż 30 dni są do usunięcia'
);
select is(
  public.mark_photos_deleted('11111111-1111-1111-1111-111111111111', array['c0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001']::uuid[]),
  1,
  'oznaczamy jako usunięte tylko odrzucone zgłoszenia tej osoby'
);
select is(
  (select count(*)::int from public.list_expired_rejected_photos('11111111-1111-1111-1111-111111111111')),
  0,
  'usunięte zdjęcie nie wraca na listę'
);
select is(
  (select array_agg(photo_path order by photo_path) from public.list_my_photo_paths('11111111-1111-1111-1111-111111111111')),
  array['1111/c6.jpg', 'c1.jpg'],
  'lista zdjęć do usunięcia konta pomija już usunięte'
);

-- 14: uprawnienia
select ok(
  has_function_privilege('authenticated', 'public.get_ranking(text)', 'execute')
  and has_function_privilege('authenticated', 'public.change_nickname(text)', 'execute')
  and not has_function_privilege('anon', 'public.get_ranking(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.list_my_photo_paths(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.mark_photos_deleted(uuid,uuid[])', 'execute')
  and has_function_privilege('service_role', 'public.list_expired_rejected_photos(uuid)', 'execute')
  and has_table_privilege('service_role', 'public.sightings', 'select'),
  'uprawnienia nowych funkcji'
);

select * from finish();
rollback;
```

W `supabase/tests/map.test.sql`:
- zmień `select plan(19);` na `select plan(21);`
- do listy `insert into auth.users` dopisz użytkownika `('66666666-6666-6666-6666-666666666666', 'zoe@example.com')` (bez zgłoszeń)
- na końcu istniejącego bloku `do $$ … end; $$;` (przed `end;`) dodaj zaliczone, niepubliczne selfie dla zgłaszających (żeby mogli zgłaszać nadużycia, a mapa się nie zmieniła):

```sql
  perform public.record_sighting('aaaaaaaa-0000-0000-0000-000000000033', '33333333-3333-3333-3333-333333333333', 17.1000, 51.1050, 10, now(),
    'sightings-private', '3333/s.jpg', '3333333333333333', 'fake', (select value from v where name = 'selfie'));
  perform public.record_sighting('aaaaaaaa-0000-0000-0000-000000000044', '44444444-4444-4444-4444-444444444444', 17.1100, 51.1050, 10, now(),
    'sightings-private', '4444/s.jpg', '4444444444444444', 'fake', (select value from v where name = 'selfie'));
  perform public.record_sighting('aaaaaaaa-0000-0000-0000-000000000055', '55555555-5555-5555-5555-555555555555', 17.1200, 51.1050, 10, now(),
    'sightings-private', '5555/s.jpg', '5555555555555555', 'fake', (select value from v where name = 'selfie'));
```

- przed `select * from finish();` dodaj:

```sql
-- 20–21: kto i ile może zgłaszać
set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';
select is(public.report_sighting('aaaaaaaa-0000-0000-0000-000000000002', 'not_rat'), 'not_allowed', 'bez zaliczonego szczura nie można zgłaszać');
reset role;
update public.app_config set value = '1' where key = 'daily_report_limit';
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select is(public.report_sighting('aaaaaaaa-0000-0000-0000-000000000002', 'other'), 'limit', 'dzienny limit zgłoszeń nadużyć');
```

(Na końcu pliku rola to już `authenticated` z claimami użytkownika 5; użytkownik 3 ma wtedy 1 zapisane zgłoszenie nadużycia, więc limit 1 daje `'limit'`.)

- [ ] **Step 2: Uruchom testy i sprawdź, że nie przechodzą**

Run: `npm run test:db`
Expected: FAIL w `social.test.sql` (brak `get_ranking`) i w `map.test.sql` (asercje 20–21).

- [ ] **Step 3: Migracja**

Utwórz `supabase/migrations/20261004000100_social.sql`:

```sql
-- Ranking, zmiana pseudonimu, limity zgłoszeń nadużyć i sprzątanie odrzuconych zdjęć.

insert into public.app_config (key, value, description) values
  ('daily_report_limit', '10', 'Maksymalna liczba zgłoszeń nadużyć jednej osoby na dobę (czas polski)'),
  ('rejected_photo_retention_days', '30', 'Po ilu dniach usuwamy zdjęcia odrzuconych zgłoszeń');

alter table public.sightings add column photo_deleted_at timestamptz;

-- Edge Functions (service_role) czytają zgłoszenia także bezpośrednio (np. retry-pending).
grant select on public.sightings to service_role;

create function public.get_ranking(p_period text)
returns table (place bigint, nickname text, rats bigint, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with scores as (
    select s.user_id, sum(s.rats_awarded)::bigint as rats, max(s.created_at) as last_at
      from public.sightings s
     where s.status = 'accepted'
       and s.rats_awarded > 0
       and p_period in ('month', 'all')
       and (p_period = 'all'
            or s.created_at >= date_trunc('month', now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw')
     group by s.user_id
  ),
  ranked as (
    -- Remis: wyżej ten, kto osiągnął wynik wcześniej (wcześniejsze ostatnie zaliczone zgłoszenie).
    select sc.user_id, sc.rats, row_number() over (order by sc.rats desc, sc.last_at asc) as place
      from scores sc
      join public.profiles p on p.id = sc.user_id
     where p.nickname is not null
  )
  select r.place, p.nickname, r.rats, r.user_id = (select auth.uid())
    from ranked r
    join public.profiles p on p.id = r.user_id
   where r.place <= 50 or r.user_id = (select auth.uid())
   order by r.place
$$;

create function public.change_nickname(p_nickname text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.profiles
     set nickname = p_nickname
   where id = auth.uid()
     and terms_accepted_at is not null;

  if not found then
    raise exception 'not onboarded' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.report_sighting(p_sighting_id uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_reports integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Zgłosić można tylko to, co widać na mapie.
  select s.user_id into v_owner
    from public.sightings s
   where s.id = p_sighting_id
     and s.public_on_map
     and not s.hidden
     and s.status in ('accepted', 'accepted_no_points')
   for update;

  if v_owner is null then
    return 'not_found';
  end if;
  if v_owner = v_user then
    return 'own';
  end if;

  -- Ochrona przed jednorazowymi kontami: zgłaszać mogą osoby z co najmniej jednym zaliczonym szczurem.
  if not exists (select 1 from public.sightings where user_id = v_user and status = 'accepted') then
    return 'not_allowed';
  end if;
  if (select count(*) from public.reports where reporter_id = v_user and created_at >= public.warsaw_day_start())
     >= public.config_int('daily_report_limit') then
    return 'limit';
  end if;

  insert into public.reports (sighting_id, reporter_id, reason)
  values (p_sighting_id, v_user, p_reason)
  on conflict (sighting_id, reporter_id) do nothing;
  if not found then
    return 'already';
  end if;

  select count(*) into v_reports from public.reports where sighting_id = p_sighting_id;
  if v_reports >= public.config_int('reports_to_hide') then
    update public.sightings set hidden = true where id = p_sighting_id;
    return 'hidden';
  end if;

  return 'reported';
end;
$$;

create function public.list_expired_rejected_photos(p_user_id uuid)
returns table (id uuid, photo_bucket text, photo_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.photo_bucket, s.photo_path
    from public.sightings s
   where s.user_id = p_user_id
     and s.status = 'rejected'
     and s.photo_deleted_at is null
     and s.created_at < now() - make_interval(days => public.config_int('rejected_photo_retention_days'))
   order by s.created_at
   limit 20
$$;

create function public.mark_photos_deleted(p_user_id uuid, p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.sightings
     set photo_deleted_at = now()
   where user_id = p_user_id
     and id = any (p_ids)
     and status = 'rejected'
     and photo_deleted_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.list_my_photo_paths(p_user_id uuid)
returns table (photo_bucket text, photo_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.photo_bucket, s.photo_path
    from public.sightings s
   where s.user_id = p_user_id
     and s.photo_deleted_at is null
$$;

revoke execute on function public.get_ranking(text) from public, anon, authenticated;
revoke execute on function public.change_nickname(text) from public, anon, authenticated;
revoke execute on function public.list_expired_rejected_photos(uuid) from public, anon, authenticated;
revoke execute on function public.mark_photos_deleted(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.list_my_photo_paths(uuid) from public, anon, authenticated;

grant execute on function public.get_ranking(text) to authenticated;
grant execute on function public.change_nickname(text) to authenticated;
grant execute on function public.list_expired_rejected_photos(uuid) to service_role;
grant execute on function public.mark_photos_deleted(uuid, uuid[]) to service_role;
grant execute on function public.list_my_photo_paths(uuid) to service_role;
```

- [ ] **Step 4: Zastosuj migrację i uruchom testy**

Run: `npm run db:reset && npm run test:db`
Expected: `Result: PASS` (social.test.sql: 14, map.test.sql: 21).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261004000100_social.sql supabase/tests/social.test.sql supabase/tests/map.test.sql
git commit -m "feat: add ranking, nickname change, report limits and photo retention in database"
```

---

### Task 3: Usuwanie konta i sprzątanie zdjęć (Edge Functions)

**Files:**
- Create: `supabase/functions/_shared/storageCleanup.ts`, `supabase/functions/_shared/storageCleanup.test.ts`, `supabase/functions/delete-account/index.ts`, `supabase/functions/delete-account/deno.json`
- Modify: `supabase/functions/retry-pending/index.ts`, `supabase/config.toml` (wpis dodaje `supabase functions new`), `scripts/smoke-sighting.mjs`

**Interfaces:**
- Consumes: `list_expired_rejected_photos`, `mark_photos_deleted`, `list_my_photo_paths` (Task 2); kaskadowe klucze obce od `auth.users`
- Produces:
  - `storageCleanup.ts`: `interface StoredPhoto { photo_bucket: string; photo_path: string }`, `groupPathsByBucket(rows: StoredPhoto[]): Map<string, string[]>`, `chunk<T>(items: T[], size: number): T[][]`
  - `POST /functions/v1/delete-account` (JWT użytkownika) → `200 {"deleted": true}` | `500 {"error":"internal"}` | `405`
  - `retry-pending` po rozstrzygnięciu zaległych usuwa ze Storage odrzucone zdjęcia starsze niż 30 dni i oznacza je `photo_deleted_at`; błędy sprzątania tylko logowane

- [ ] **Step 1: Napisz testy pomocnika**

Utwórz `supabase/functions/_shared/storageCleanup.test.ts`:

```ts
// @vitest-environment node
import { expect, test } from 'vitest'
import { chunk, groupPathsByBucket } from './storageCleanup.ts'

test('grupuje ścieżki zdjęć według bucketu', () => {
  const grouped = groupPathsByBucket([
    { photo_bucket: 'map-photos', photo_path: 'a.jpg' },
    { photo_bucket: 'sightings-private', photo_path: 'u1/b.jpg' },
    { photo_bucket: 'map-photos', photo_path: 'c.jpg' },
  ])
  expect([...grouped.entries()]).toEqual([
    ['map-photos', ['a.jpg', 'c.jpg']],
    ['sightings-private', ['u1/b.jpg']],
  ])
})

test('dzieli listę na paczki', () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  expect(chunk([], 100)).toEqual([])
})
```

Run: `npx vitest run supabase/functions/_shared/storageCleanup.test.ts`
Expected: FAIL — `Failed to resolve import "./storageCleanup.ts"`.

- [ ] **Step 2: Implementacja pomocnika**

Utwórz `supabase/functions/_shared/storageCleanup.ts`:

```ts
export interface StoredPhoto {
  photo_bucket: string
  photo_path: string
}

export function groupPathsByBucket(rows: StoredPhoto[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>()
  for (const row of rows) {
    const paths = grouped.get(row.photo_bucket) ?? []
    paths.push(row.photo_path)
    grouped.set(row.photo_bucket, paths)
  }
  return grouped
}

export function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size))
  return batches
}
```

Run: `npx vitest run supabase/functions/_shared/storageCleanup.test.ts`
Expected: PASS.

- [ ] **Step 3: Funkcja `delete-account`**

```bash
npx supabase functions new delete-account
grep -A3 "functions.delete-account" supabase/config.toml
```

Wpis `[functions.delete-account]` w `supabase/config.toml` musi mieć `verify_jwt = false` i `import_map = "./functions/delete-account/deno.json"` — tak jak `retry-pending` (JWT sprawdza `withSupabase`); popraw, jeśli CLI wygenerowało inaczej.

Zastąp `supabase/functions/delete-account/deno.json`:

```json
{
  "imports": {
    "@supabase/functions-js": "jsr:@supabase/functions-js@^2",
    "@supabase/server": "npm:@supabase/server@^1"
  }
}
```

Zastąp `supabase/functions/delete-account/index.ts`:

```ts
import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import { chunk, groupPathsByBucket, type StoredPhoto } from '../_shared/storageCleanup.ts'

// Usuwa konto zalogowanej osoby: najpierw jej zdjęcia ze Storage, potem konto auth.
// Profil, zgłoszenia, dziennik racików, zgłoszenia nadużyć i osiągnięcia znikają kaskadą.
export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 })
    try {
      const userId = ctx.userClaims!.id
      const admin = ctx.supabaseAdmin

      const { data, error } = await admin.rpc('list_my_photo_paths', { p_user_id: userId })
      if (error) throw error

      for (const [bucket, paths] of groupPathsByBucket((data ?? []) as StoredPhoto[])) {
        for (const batch of chunk(paths, 100)) {
          const removal = await admin.storage.from(bucket).remove(batch)
          if (removal.error) console.error(`delete-account: nie udało się usunąć zdjęć z ${bucket}`, removal.error)
        }
      }

      const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
      if (deleteError) throw deleteError

      return Response.json({ deleted: true })
    } catch (error) {
      console.error('delete-account: nieobsłużony błąd', error)
      return Response.json({ error: 'internal' }, { status: 500 })
    }
  }),
}
```

- [ ] **Step 4: Sprzątanie w `retry-pending`**

W `supabase/functions/retry-pending/index.ts`:
- dodaj import `import { groupPathsByBucket, type StoredPhoto } from '../_shared/storageCleanup.ts'`
- zamień linię `if (pending.length === 0) return Response.json({ resolved: 0 })` tak, aby przy braku zaległych **nie** wychodzić wcześniej: obejmij istniejącą pętlę `for (const sighting of pending)` warunkiem `if (pending.length > 0) { … }` (zmienna `verifier` tworzona wewnątrz tego bloku), a `let resolved = 0` zostaw przed blokiem.
- bezpośrednio przed `return Response.json({ resolved })` dodaj:

```ts
      // Zdjęcia odrzuconych zgłoszeń trzymamy 30 dni — potem usuwamy je przy okazji otwarcia aplikacji.
      try {
        const { data: expired, error: expiredError } = await admin.rpc('list_expired_rejected_photos', { p_user_id: userId })
        if (expiredError) throw expiredError
        const rows = (expired ?? []) as (StoredPhoto & { id: string })[]
        const removedIds: string[] = []
        for (const [bucket, paths] of groupPathsByBucket(rows)) {
          const removal = await admin.storage.from(bucket).remove(paths)
          if (removal.error) {
            console.error(`retry-pending: nie udało się usunąć starych zdjęć z ${bucket}`, removal.error)
            continue
          }
          removedIds.push(...rows.filter((row) => row.photo_bucket === bucket).map((row) => row.id))
        }
        if (removedIds.length > 0) {
          const { error: markError } = await admin.rpc('mark_photos_deleted', { p_user_id: userId, p_ids: removedIds })
          if (markError) throw markError
        }
      } catch (cleanupError) {
        console.error('retry-pending: sprzątanie zdjęć nie powiodło się', cleanupError)
      }
```

- [ ] **Step 5: Test dymny**

W `scripts/smoke-sighting.mjs`:
- zamień check pierwszego zgłoszenia na zapamiętanie wyniku:

```js
const firstResult = await send(first, 51.11, 17.032)
check('zaliczony szczur na Rynku (+ osiągnięcie „Pierwszy szczur”)', firstResult,
  (d) => d.status === 'accepted' && d.rats_awarded === 1 && d.tokens_awarded === 10 && d.public_on_map === true &&
    Array.isArray(d.achievements) && d.achievements.some((a) => a.code === 'first_rat'))
```

- w checku profilu zmień oczekiwane saldo na `p.tokens_balance === 35` (10 za szczura + 25 za „Pierwszy szczur”) i opis na `'profil po zgłoszeniach (z nagrodą za osiągnięcie)'`
- na końcu pliku dodaj:

```js
const removal = await client.functions.invoke('delete-account', { body: {} })
check('usunięcie konta', removal.data, (d) => d?.deleted === true)
const lookup = await admin.auth.admin.getUserById(created.data.user.id)
check('konto zniknęło', lookup.data?.user ? 'istnieje' : 'brak', (s) => s === 'brak')
const leftover = await admin.storage.from('map-photos').list('', { search: `${firstResult.id}.jpg` })
check('zdjęcie z mapy usunięte', leftover.data?.length ?? -1, (n) => n === 0)
```

Run (dwa terminale): `npm run functions:serve` (zostaw uruchomione) i `npm run smoke`
Expected: 10 linii `✓`, kod wyjścia 0. Zatrzymaj `functions:serve` po PID.

- [ ] **Step 6: Uruchom testy**

Run: `npm test && npx tsc -b && npm run test:db`
Expected: wszystko przechodzi.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions supabase/config.toml scripts/smoke-sighting.mjs
git status --short supabase/functions   # .env ani .env.local nie mogą być dodane
git commit -m "feat: add delete-account function and rejected photo cleanup"
```

---

### Task 4: Osiągnięcia w aplikacji

**Files:**
- Create: `src/profile/achievementsApi.ts`, `src/profile/achievementsApi.test.ts`, `src/profile/Achievements.tsx`, `src/profile/Achievements.test.tsx`
- Modify: `src/report/reportApi.ts`, `src/report/reportApi.test.ts`, `src/report/ResultView.tsx`, `src/report/ReportScreen.test.tsx`, `src/profile/ProfileScreen.tsx`, `src/profile/ProfileScreen.test.tsx`, `src/App.test.tsx`, `src/i18n/pl.json`, `src/shell/shell.css`

**Interfaces:**
- Consumes: `my_achievements()`, wynik `sighting_result` z `achievements` (Task 1)
- Produces:
  - `achievementsApi.ts`: `interface Achievement { position: number; code: string | null; name: string | null; description: string | null; secret: boolean; rewardTokens: number | null; unlockedAt: string | null }`, `fetchMyAchievements(): Promise<Achievement[]>` (rzuca przy błędzie)
  - `reportApi.ts`: `interface UnlockedAchievement { code: string; name: string; secret: boolean; rewardTokens: number }`; wariant `recorded` w `SubmitOutcome` ma pole opcjonalne `achievements?: UnlockedAchievement[]` (`toSubmitResult` zawsze je ustawia, domyślnie `[]`)
  - `Achievements()` — sekcja w Profilu

- [ ] **Step 1: Teksty**

Dodaj do `src/i18n/pl.json` (skryptem JSON, wcięcia 2 spacje) nową sekcję najwyższego poziomu i klucze w `result`:

```json
  "achievements": {
    "title": "Osiągnięcia",
    "progress": "{{unlocked}} z {{total}}",
    "secretsLeft_one": "Został {{count}} sekret do odkrycia",
    "secretsLeft_few": "Zostały {{count}} sekrety do odkrycia",
    "secretsLeft_many": "Zostało {{count}} sekretów do odkrycia",
    "secretsLeft_other": "Zostało {{count}} sekretu do odkrycia",
    "secretName": "???",
    "secretHint": "Sekretne osiągnięcie — odkryjesz je przypadkiem 😉",
    "reward": "+{{raciki}}",
    "loadFailed": "Nie udało się pobrać osiągnięć."
  }
```

w sekcji `result` dodaj:

```json
    "achievementUnlocked": "🏆 Nowe osiągnięcie: {{name}} (+{{raciki}})",
    "secretUnlocked": "🤫 Sekretne osiągnięcie odkryte: {{name}}! (+{{raciki}})"
```

- [ ] **Step 2: Napisz testy**

Utwórz `src/profile/achievementsApi.test.ts`:

```ts
import { expect, test, vi } from 'vitest'
import { fetchMyAchievements } from './achievementsApi'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

test('zamienia wiersze osiągnięć na obiekty aplikacji', async () => {
  mocks.rpc.mockResolvedValue({
    data: [
      { sort_order: 1, code: 'first_rat', name: 'Pierwszy szczur', description: 'Opis', secret: false, reward_tokens: 25, unlocked_at: '2026-10-04T10:00:00Z' },
      { sort_order: 10, code: null, name: null, description: null, secret: true, reward_tokens: null, unlocked_at: null },
    ],
    error: null,
  })
  expect(await fetchMyAchievements()).toEqual([
    { position: 1, code: 'first_rat', name: 'Pierwszy szczur', description: 'Opis', secret: false, rewardTokens: 25, unlockedAt: '2026-10-04T10:00:00Z' },
    { position: 10, code: null, name: null, description: null, secret: true, rewardTokens: null, unlockedAt: null },
  ])
  expect(mocks.rpc).toHaveBeenCalledWith('my_achievements')
})

test('błąd jest zgłaszany wyżej', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: new Error('offline') })
  await expect(fetchMyAchievements()).rejects.toThrow('offline')
})
```

Utwórz `src/profile/Achievements.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { Achievements } from './Achievements'
import { fetchMyAchievements } from './achievementsApi'

vi.mock('./achievementsApi', () => ({ fetchMyAchievements: vi.fn() }))

const unlocked = { position: 1, code: 'first_rat', name: 'Pierwszy szczur', description: 'Zalicz swojego pierwszego szczura.', secret: false, rewardTokens: 25, unlockedAt: '2026-10-04T10:00:00Z' }
const locked = { position: 2, code: 'rats_10', name: 'Dziesiątka', description: 'Zalicz 10 szczurów.', secret: false, rewardTokens: 30, unlockedAt: null }
const secretLocked = { position: 10, code: null, name: null, description: null, secret: true, rewardTokens: null, unlockedAt: null }
const secretUnlocked = { position: 7, code: 'selfie', name: 'Szczurze Selfie', description: 'Zrób sobie selfie ze szczurem.', secret: true, rewardTokens: 75, unlockedAt: '2026-10-04T11:00:00Z' }

test('pokazuje postęp, odblokowane, zablokowane i ukryte sekrety', async () => {
  vi.mocked(fetchMyAchievements).mockResolvedValue([unlocked, locked, secretUnlocked, secretLocked, { ...secretLocked, position: 11 }])
  render(<Achievements />)

  expect(await screen.findByText('2 z 5')).toBeInTheDocument()
  expect(screen.getByText('Pierwszy szczur')).toBeInTheDocument()
  expect(screen.getByText('Szczurze Selfie')).toBeInTheDocument()
  expect(screen.getByText('Dziesiątka')).toBeInTheDocument()
  expect(screen.getAllByText('???')).toHaveLength(2)
  expect(screen.getByText('Zostały 2 sekrety do odkrycia')).toBeInTheDocument()
  expect(screen.getByText('+25 racików')).toBeInTheDocument()
})

test('błąd pobierania pokazuje komunikat', async () => {
  vi.mocked(fetchMyAchievements).mockRejectedValue(new Error('offline'))
  render(<Achievements />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się pobrać osiągnięć.')
})
```

W `src/report/reportApi.test.ts`:
- w dwóch oczekiwaniach `toSubmitResult` dla `accepted` i `rejected` dodaj pole `achievements: []`, a w teście `wysyła zdjęcie z pozycją jako formularz` dodaj do oczekiwanego wyniku `achievements: []`
- dopisz test:

```ts
test('odczytuje odblokowane osiągnięcia', () => {
  expect(
    toSubmitResult({
      status: 'accepted',
      reject_reason: null,
      rats_awarded: 1,
      tokens_awarded: 10,
      achievements: [{ code: 'selfie', name: 'Szczurze Selfie', secret: true, reward_tokens: 75 }],
    }),
  ).toEqual({
    kind: 'recorded',
    status: 'accepted',
    rejectReason: null,
    ratsAwarded: 1,
    tokensAwarded: 10,
    achievements: [{ code: 'selfie', name: 'Szczurze Selfie', secret: true, rewardTokens: 75 }],
  })
})
```

W `src/report/ReportScreen.test.tsx` dopisz test:

```tsx
test('zaliczony szczur pokazuje odblokowane osiągnięcia', async () => {
  mocks.submitSighting.mockResolvedValue({
    kind: 'recorded',
    status: 'accepted',
    rejectReason: null,
    ratsAwarded: 1,
    tokensAwarded: 10,
    achievements: [
      { code: 'first_rat', name: 'Pierwszy szczur', secret: false, rewardTokens: 25 },
      { code: 'selfie', name: 'Szczurze Selfie', secret: true, rewardTokens: 75 },
    ],
  })
  render(<ReportScreen onRecorded={vi.fn()} />)

  await takePhoto()

  expect(await screen.findByText('🏆 Nowe osiągnięcie: Pierwszy szczur (+25 racików)')).toBeInTheDocument()
  expect(screen.getByText('🤫 Sekretne osiągnięcie odkryte: Szczurze Selfie! (+75 racików)')).toBeInTheDocument()
})
```

Run: `npx vitest run src/profile/achievementsApi.test.ts src/profile/Achievements.test.tsx src/report`
Expected: FAIL (brak modułów i pola `achievements`).

- [ ] **Step 3: Implementacja API i wyniku zgłoszenia**

Utwórz `src/profile/achievementsApi.ts`:

```ts
import { supabase } from '../lib/supabase'

export interface Achievement {
  position: number
  code: string | null
  name: string | null
  description: string | null
  secret: boolean
  rewardTokens: number | null
  unlockedAt: string | null
}

interface AchievementRow {
  sort_order: number
  code: string | null
  name: string | null
  description: string | null
  secret: boolean
  reward_tokens: number | null
  unlocked_at: string | null
}

export async function fetchMyAchievements(): Promise<Achievement[]> {
  const { data, error } = await supabase.rpc('my_achievements')
  if (error) throw error
  return ((data ?? []) as AchievementRow[]).map((row) => ({
    position: row.sort_order,
    code: row.code,
    name: row.name,
    description: row.description,
    secret: row.secret,
    rewardTokens: row.reward_tokens,
    unlockedAt: row.unlocked_at,
  }))
}
```

W `src/report/reportApi.ts`:
- dodaj typ i zmień wariant `recorded`:

```ts
export interface UnlockedAchievement {
  code: string
  name: string
  secret: boolean
  rewardTokens: number
}

export type SubmitOutcome =
  | { kind: 'blocked'; reason: BlockReason }
  | {
      kind: 'recorded'
      status: RecordedStatus
      rejectReason: string | null
      ratsAwarded: number
      tokensAwarded: number
      achievements?: UnlockedAchievement[]
    }
```

- w `toSubmitResult` w gałęzi `recorded` dodaj pole:

```ts
      achievements: Array.isArray(value.achievements)
        ? (value.achievements as Record<string, unknown>[]).map((item) => ({
            code: String(item.code),
            name: String(item.name),
            secret: item.secret === true,
            rewardTokens: Number(item.reward_tokens ?? 0),
          }))
        : [],
```

W `src/report/ResultView.tsx`:
- pod akapitem z tekstem (`<p className={…}>{text}</p>`) dodaj listę:

```tsx
      {unlocked.length > 0 && (
        <ul className="result__achievements">
          {unlocked.map((achievement) => (
            <li key={achievement.code}>
              {t(achievement.secret ? 'result.secretUnlocked' : 'result.achievementUnlocked', {
                name: achievement.name,
                raciki: t('result.raciki', { count: achievement.rewardTokens }),
              })}
            </li>
          ))}
        </ul>
      )}
```

- przed `return` dodaj `const unlocked = outcome.kind === 'recorded' ? outcome.achievements ?? [] : []`

Dopisz do `src/shell/shell.css`:

```css
.result__achievements {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-weight: 700;
}
```

- [ ] **Step 4: Sekcja osiągnięć w Profilu**

Utwórz `src/profile/Achievements.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchMyAchievements, type Achievement } from './achievementsApi'

type State = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; items: Achievement[] }

export function Achievements() {
  const { t } = useTranslation()
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let active = true
    fetchMyAchievements().then(
      (items) => {
        if (active) setState({ kind: 'loaded', items })
      },
      () => {
        if (active) setState({ kind: 'failed' })
      },
    )
    return () => {
      active = false
    }
  }, [])

  if (state.kind === 'loading') return null
  if (state.kind === 'failed') {
    return (
      <p className="error" role="alert">
        {t('achievements.loadFailed')}
      </p>
    )
  }

  const unlockedCount = state.items.filter((item) => item.unlockedAt).length
  const secretsLeft = state.items.filter((item) => item.secret && !item.unlockedAt).length

  return (
    <section className="stack">
      <div className="achievements__header">
        <h2>{t('achievements.title')}</h2>
        <span className="muted">{t('achievements.progress', { unlocked: unlockedCount, total: state.items.length })}</span>
      </div>
      {secretsLeft > 0 && <p className="muted">{t('achievements.secretsLeft', { count: secretsLeft })}</p>}
      <ul className="achievements">
        {state.items.map((item) => {
          const hidden = item.secret && !item.unlockedAt
          return (
            <li
              key={item.position}
              className={item.unlockedAt ? 'card achievements__item achievements__item--unlocked' : 'card achievements__item'}
            >
              <span className="achievements__icon" aria-hidden="true">
                {item.unlockedAt ? '🏆' : hidden ? '❔' : '🔒'}
              </span>
              <div className="stack achievements__text">
                <strong>{hidden ? t('achievements.secretName') : item.name}</strong>
                <span className="muted">{hidden ? t('achievements.secretHint') : item.description}</span>
                {!hidden && item.rewardTokens !== null && (
                  <span className="achievements__reward">
                    {t('achievements.reward', { raciki: t('result.raciki', { count: item.rewardTokens }) })}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
```

Dopisz do `src/shell/shell.css`:

```css
.achievements__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.achievements {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.achievements__item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px;
  opacity: 0.7;
}

.achievements__item--unlocked {
  opacity: 1;
  outline: 2px solid var(--rose);
}

.achievements__icon {
  font-size: 24px;
  line-height: 1;
}

.achievements__text {
  gap: 2px;
}

.achievements__reward {
  color: var(--rose-dark);
  font-weight: 800;
}
```

W `src/profile/ProfileScreen.tsx` dodaj import `import { Achievements } from './Achievements'` i wstaw `<Achievements />` bezpośrednio **przed** `<MySightings />`.

W `src/profile/ProfileScreen.test.tsx` i `src/App.test.tsx` dodaj mock (ścieżka w App: `'./profile/Achievements'`):

```tsx
vi.mock('./Achievements', () => ({ Achievements: () => null }))
```

- [ ] **Step 5: Uruchom testy, typy i lint**

Run: `npm test && npx tsc -b && npm run lint`
Expected: wszystko przechodzi, 0 ostrzeżeń.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat: show achievements in profile and unlocked achievements after a sighting"
```

---

### Task 5: Ranking w aplikacji

**Files:**
- Create: `src/ranking/rankingApi.ts`, `src/ranking/rankingApi.test.ts`, `src/ranking/RankingScreen.tsx`, `src/ranking/RankingScreen.test.tsx`, `src/ranking/ranking.css`
- Modify: `src/shell/AppShell.tsx`, `src/main.tsx`, `src/i18n/pl.json`

**Interfaces:**
- Consumes: `get_ranking(p_period)` (Task 2)
- Produces: `type RankingPeriod = 'month' | 'all'`, `interface RankingRow { place: number; nickname: string; rats: number; isMe: boolean }`, `fetchRanking(period: RankingPeriod): Promise<RankingRow[]>` (rzuca przy błędzie), `RankingScreen()`

- [ ] **Step 1: Teksty**

Dodaj do `src/i18n/pl.json` sekcję najwyższego poziomu:

```json
  "ranking": {
    "title": "Ranking",
    "month": "Ten miesiąc",
    "all": "Od początku",
    "rats_one": "{{count}} szczur",
    "rats_few": "{{count}} szczury",
    "rats_many": "{{count}} szczurów",
    "rats_other": "{{count}} szczura",
    "me": "(Ty)",
    "empty": "Nikt jeszcze nie zaliczył szczura w tym okresie. Bądź pierwszą osobą na liście 🐀",
    "loadFailed": "Nie udało się pobrać rankingu."
  }
```

- [ ] **Step 2: Napisz testy**

Utwórz `src/ranking/rankingApi.test.ts`:

```ts
import { expect, test, vi } from 'vitest'
import { fetchRanking } from './rankingApi'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

test('pobiera ranking wybranego okresu', async () => {
  mocks.rpc.mockResolvedValue({ data: [{ place: 1, nickname: 'Ala', rats: 12, is_me: true }], error: null })
  expect(await fetchRanking('month')).toEqual([{ place: 1, nickname: 'Ala', rats: 12, isMe: true }])
  expect(mocks.rpc).toHaveBeenCalledWith('get_ranking', { p_period: 'month' })
})

test('błąd jest zgłaszany wyżej', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: new Error('offline') })
  await expect(fetchRanking('all')).rejects.toThrow('offline')
})
```

Utwórz `src/ranking/RankingScreen.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { fetchRanking } from './rankingApi'
import { RankingScreen } from './RankingScreen'

vi.mock('./rankingApi', () => ({ fetchRanking: vi.fn() }))

test('pokazuje ranking miesięczny i zaznacza moją pozycję', async () => {
  vi.mocked(fetchRanking).mockResolvedValue([
    { place: 1, nickname: 'Ala', rats: 12, isMe: false },
    { place: 2, nickname: 'Ola', rats: 3, isMe: true },
  ])
  render(<RankingScreen />)

  const items = await screen.findAllByRole('listitem')
  expect(items).toHaveLength(2)
  expect(within(items[0]).getByText('Ala')).toBeInTheDocument()
  expect(within(items[0]).getByText('12 szczurów')).toBeInTheDocument()
  expect(within(items[1]).getByText('(Ty)')).toBeInTheDocument()
  expect(fetchRanking).toHaveBeenCalledWith('month')
  expect(screen.getByRole('button', { name: 'Ten miesiąc' })).toHaveAttribute('aria-pressed', 'true')
})

test('przełącza na ranking od początku', async () => {
  vi.mocked(fetchRanking).mockResolvedValue([])
  render(<RankingScreen />)
  await userEvent.click(await screen.findByRole('button', { name: 'Od początku' }))
  expect(fetchRanking).toHaveBeenLastCalledWith('all')
})

test('moja pozycja spoza czołówki jest oddzielona', async () => {
  vi.mocked(fetchRanking).mockResolvedValue([
    { place: 50, nickname: 'Pięćdziesiąty', rats: 4, isMe: false },
    { place: 73, nickname: 'Ja', rats: 1, isMe: true },
  ])
  render(<RankingScreen />)
  expect(await screen.findByText('…')).toBeInTheDocument()
  expect(screen.getByText('73.')).toBeInTheDocument()
})

test('pusty ranking i błąd', async () => {
  vi.mocked(fetchRanking).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('offline'))
  render(<RankingScreen />)
  expect(await screen.findByText(/Bądź pierwszą osobą na liście/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Od początku' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się pobrać rankingu.')
})
```

Run: `npx vitest run src/ranking`
Expected: FAIL — brak modułów.

- [ ] **Step 3: Implementacja**

Utwórz `src/ranking/rankingApi.ts`:

```ts
import { supabase } from '../lib/supabase'

export type RankingPeriod = 'month' | 'all'

export interface RankingRow {
  place: number
  nickname: string
  rats: number
  isMe: boolean
}

interface Row {
  place: number
  nickname: string
  rats: number
  is_me: boolean
}

export async function fetchRanking(period: RankingPeriod): Promise<RankingRow[]> {
  const { data, error } = await supabase.rpc('get_ranking', { p_period: period })
  if (error) throw error
  return ((data ?? []) as Row[]).map((row) => ({
    place: Number(row.place),
    nickname: row.nickname,
    rats: Number(row.rats),
    isMe: row.is_me,
  }))
}
```

Utwórz `src/ranking/RankingScreen.tsx`:

```tsx
import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchRanking, type RankingPeriod, type RankingRow } from './rankingApi'

type State = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; rows: RankingRow[] }

const PERIODS: RankingPeriod[] = ['month', 'all']

export function RankingScreen() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<RankingPeriod>('month')
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let active = true
    fetchRanking(period).then(
      (rows) => {
        if (active) setState({ kind: 'loaded', rows })
      },
      () => {
        if (active) setState({ kind: 'failed' })
      },
    )
    return () => {
      active = false
    }
  }, [period])

  return (
    <section className="screen stack">
      <h1>{t('ranking.title')}</h1>
      <div className="ranking__periods">
        {PERIODS.map((option) => (
          <button
            key={option}
            type="button"
            className={option === period ? 'btn' : 'btn btn--ghost'}
            aria-pressed={option === period}
            onClick={() => {
              setState({ kind: 'loading' })
              setPeriod(option)
            }}
          >
            {t(`ranking.${option}`)}
          </button>
        ))}
      </div>

      {state.kind === 'loading' && <p className="muted">{t('app.loading')}</p>}
      {state.kind === 'failed' && (
        <p className="error" role="alert">
          {t('ranking.loadFailed')}
        </p>
      )}
      {state.kind === 'loaded' && state.rows.length === 0 && <p className="muted">{t('ranking.empty')}</p>}
      {state.kind === 'loaded' && state.rows.length > 0 && (
        <ol className="ranking">
          {state.rows.map((row, index) => {
            const previous = state.rows[index - 1]
            return (
              <Fragment key={`${row.place}-${row.nickname}`}>
                {previous && row.place > previous.place + 1 && (
                  <li className="ranking__gap" aria-hidden="true">
                    …
                  </li>
                )}
                <li className={row.isMe ? 'card ranking__row ranking__row--me' : 'card ranking__row'}>
                  <span className="ranking__place">{row.place}.</span>
                  <strong className="ranking__name">
                    {row.nickname} {row.isMe && <span className="muted">{t('ranking.me')}</span>}
                  </strong>
                  <span>{t('ranking.rats', { count: row.rats })}</span>
                </li>
              </Fragment>
            )
          })}
        </ol>
      )}
    </section>
  )
}
```

Uwaga do testu „moja pozycja spoza czołówki”: element `…` ma `aria-hidden`, ale `getByText` go znajdzie; liczba elementów `listitem` w pierwszym teście się nie zmienia (brak luki).

Utwórz `src/ranking/ranking.css`:

```css
.ranking__periods {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.ranking {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ranking__row {
  display: grid;
  grid-template-columns: 3ch 1fr auto;
  gap: 10px;
  align-items: baseline;
  padding: 10px 12px;
}

.ranking__row--me {
  outline: 2px solid var(--rose);
}

.ranking__place {
  font-weight: 800;
  color: var(--rose-dark);
}

.ranking__name {
  overflow-wrap: anywhere;
}

.ranking__gap {
  text-align: center;
  color: var(--text-muted);
}
```

W `src/main.tsx` dodaj `import './ranking/ranking.css'` bezpośrednio po `import './map/map.css'`.

W `src/shell/AppShell.tsx` ranking to ostatnia zakładka bez ekranu (`Tab` = `'map' | 'report' | 'ranking' | 'profile'`), więc zamień ostatnią gałąź `: (<ComingSoon … />)` na `: (<RankingScreen />)`, zamień import `ComingSoon` na `import { RankingScreen } from '../ranking/RankingScreen'`, usuń plik `src/shell/ComingSoon.tsx` i klucz `comingSoon` z `pl.json` (żaden test go nie sprawdza — potwierdź `grep -rn "ComingSoon\|comingSoon\|wkrótce" src`).

W `src/App.test.tsx` dodaj mock, żeby test nie wołał Supabase po przełączeniu zakładki:

```tsx
vi.mock('./ranking/rankingApi', () => ({ fetchRanking: vi.fn(async () => []) }))
```

- [ ] **Step 4: Uruchom testy, typy i lint**

Run: `npm test && npx tsc -b && npm run lint`
Expected: wszystko przechodzi, 0 ostrzeżeń.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: add monthly and all-time ranking screen"
```

---

### Task 6: Profil — zmiana pseudonimu, usuwanie konta i drobne zmiany

**Files:**
- Create: `src/profile/NicknameEditor.tsx`, `src/profile/NicknameEditor.test.tsx`, `src/profile/accountApi.ts`, `src/profile/DeleteAccount.tsx`, `src/profile/DeleteAccount.test.tsx`
- Modify: `src/profile/profileApi.ts`, `src/profile/profileApi.test.ts`, `src/profile/ProfileScreen.tsx`, `src/profile/ProfileScreen.test.tsx`, `src/App.test.tsx`, `src/profile/mySightingsApi.ts`, `src/profile/mySightingsApi.test.ts`, `src/map/mapApi.ts`, `src/map/mapApi.test.ts`, `src/legal/Privacy.tsx`, `src/legal/legalConfig.ts`, `src/i18n/pl.json`

**Interfaces:**
- Consumes: `change_nickname` (Task 2), `delete-account` (Task 3), `checkNickname` (`src/onboarding/nickname.ts`), `onboardingFailureFor`, `OnboardingResult` (`profileApi.ts`), `signOut` (`src/auth/authApi.ts`)
- Produces: `changeNickname(nickname: string): Promise<OnboardingResult>`, `deleteAccount(): Promise<boolean>`, `NicknameEditor({ nickname, onChange })`, `DeleteAccount()`; `ReportResult` rozszerzony o `'not_allowed' | 'limit'`

- [ ] **Step 1: Teksty**

W `src/i18n/pl.json` (skryptem JSON):
- w sekcji `profile` dodaj:

```json
    "changeNickname": "Zmień pseudonim",
    "saveNickname": "Zapisz",
    "cancel": "Anuluj",
    "deleteTitle": "Usuń konto",
    "deleteExplain": "Usuniemy Twoje konto, wszystkie zgłoszenia, zdjęcia, raciki i osiągnięcia. Tego nie da się cofnąć.",
    "deleteConfirm": "Rozumiem, że tego nie da się cofnąć",
    "deleteForever": "Usuń konto na zawsze",
    "deleteFailed": "Nie udało się usunąć konta. Spróbuj ponownie za chwilę."
```

- w `map.reportResult` dodaj:

```json
      "not_allowed": "Zgłaszać nadużycia mogą osoby, które zaliczyły już co najmniej jednego szczura.",
      "limit": "Dzienny limit zgłoszeń nadużyć wykorzystany. Wróć jutro."
```

- [ ] **Step 2: Napisz testy**

Utwórz `src/profile/NicknameEditor.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { NicknameEditor } from './NicknameEditor'
import { changeNickname } from './profileApi'

vi.mock('./profileApi', () => ({ changeNickname: vi.fn() }))

async function edit(value: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Zmień pseudonim' }))
  const input = screen.getByLabelText('Twój pseudonim')
  await userEvent.clear(input)
  await userEvent.type(input, value)
}

test('zapisuje nowy pseudonim i odświeża profil', async () => {
  vi.mocked(changeNickname).mockResolvedValue({ ok: true })
  const onChange = vi.fn()
  render(<NicknameEditor nickname="Szczurek" onChange={onChange} />)
  await edit('Szczurołap')
  await userEvent.click(screen.getByRole('button', { name: 'Zapisz' }))
  expect(changeNickname).toHaveBeenCalledWith('Szczurołap')
  expect(onChange).toHaveBeenCalled()
  expect(screen.queryByLabelText('Twój pseudonim')).not.toBeInTheDocument()
})

test('podpowiada błędny format i blokuje zapis', async () => {
  render(<NicknameEditor nickname="Szczurek" onChange={vi.fn()} />)
  await edit('a b')
  expect(screen.getByText('Dozwolone są tylko litery, cyfry, _ i -.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Zapisz' })).toBeDisabled()
})

test('informuje o zajętym pseudonimie', async () => {
  vi.mocked(changeNickname).mockResolvedValue({ ok: false, reason: 'nickname_taken' })
  const onChange = vi.fn()
  render(<NicknameEditor nickname="Szczurek" onChange={onChange} />)
  await edit('Ola')
  await userEvent.click(screen.getByRole('button', { name: 'Zapisz' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Ten pseudonim jest już zajęty.')
  expect(onChange).not.toHaveBeenCalled()
})
```

Utwórz `src/profile/DeleteAccount.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { signOut } from '../auth/authApi'
import { deleteAccount } from './accountApi'
import { DeleteAccount } from './DeleteAccount'

vi.mock('./accountApi', () => ({ deleteAccount: vi.fn() }))
vi.mock('../auth/authApi', () => ({ signOut: vi.fn() }))

async function confirmDeletion() {
  await userEvent.click(screen.getByRole('button', { name: 'Usuń konto' }))
  const forever = screen.getByRole('button', { name: 'Usuń konto na zawsze' })
  expect(forever).toBeDisabled()
  await userEvent.click(screen.getByRole('checkbox', { name: 'Rozumiem, że tego nie da się cofnąć' }))
  await userEvent.click(forever)
}

test('usuwa konto i wylogowuje', async () => {
  vi.mocked(deleteAccount).mockResolvedValue(true)
  vi.mocked(signOut).mockResolvedValue(undefined)
  render(<DeleteAccount />)
  await confirmDeletion()
  expect(deleteAccount).toHaveBeenCalled()
  expect(signOut).toHaveBeenCalled()
})

test('błąd usuwania pokazuje komunikat i nie wylogowuje', async () => {
  vi.mocked(deleteAccount).mockResolvedValue(false)
  render(<DeleteAccount />)
  await confirmDeletion()
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się usunąć konta.')
  expect(signOut).not.toHaveBeenCalled()
})
```

W `src/profile/profileApi.test.ts` dopisz (mock `rpc` już istnieje w pliku):

```ts
test('zmiana pseudonimu wywołuje funkcję w bazie i mapuje błędy', async () => {
  mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
  await expect(changeNickname('Szczurek')).resolves.toEqual({ ok: true })
  expect(mocks.rpc).toHaveBeenCalledWith('change_nickname', { p_nickname: 'Szczurek' })
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'duplicate' } })
  await expect(changeNickname('Ola')).resolves.toEqual({ ok: false, reason: 'nickname_taken' })
})
```

(dodaj `changeNickname` do importu z `./profileApi`).

W `src/profile/mySightingsApi.test.ts` dopisz test: wiersz z `photo_bucket: 'sightings-private'`, `photo_path: 'u1/s3.jpg'` i `photo_deleted_at: '2026-10-01T00:00:00Z'` daje `photoUrl: null`, a `createSignedUrls` **nie** jest wołane dla tej ścieżki (oczekuj braku wywołania, gdy to jedyny prywatny wiersz).

W `src/map/mapApi.test.ts` w tabeli testu `zgłoszenie nadużycia` dodaj wiersze `[{ data: 'not_allowed', error: null }, 'not_allowed']` i `[{ data: 'limit', error: null }, 'limit']`.

Run: `npx vitest run src/profile src/map/mapApi.test.ts`
Expected: FAIL (brak modułów/funkcji i nowych wyników).

- [ ] **Step 3: Implementacja API**

W `src/profile/profileApi.ts` dopisz:

```ts
export async function changeNickname(nickname: string): Promise<OnboardingResult> {
  const { error } = await supabase.rpc('change_nickname', { p_nickname: nickname })
  if (!error) return { ok: true }
  return { ok: false, reason: onboardingFailureFor(error.code) }
}
```

Utwórz `src/profile/accountApi.ts`:

```ts
import { supabase } from '../lib/supabase'

// Usuwa konto na serwerze (zdjęcia, zgłoszenia, raciki, osiągnięcia); true, gdy się udało.
export async function deleteAccount(): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('delete-account', { body: {} })
  return !error && (data as { deleted?: boolean } | null)?.deleted === true
}
```

W `src/profile/mySightingsApi.ts`:
- do listy kolumn w `select(...)` dodaj `photo_deleted_at`, do `SightingRow` pole `photo_deleted_at: string | null`
- prywatne ścieżki do podpisania bierz tylko z wierszy z `photo_deleted_at === null`
- `photoUrl` = `null`, gdy `row.photo_deleted_at` jest ustawione (przed sprawdzaniem bucketu)

W `src/map/mapApi.ts`: rozszerz `ReportResult` o `'not_allowed' | 'limit'` i dopisz je do `REPORT_RESULTS`.

- [ ] **Step 4: Komponenty**

Utwórz `src/profile/NicknameEditor.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { checkNickname, type NicknameProblem } from '../onboarding/nickname'
import { changeNickname, type OnboardingFailure } from './profileApi'

const PROBLEM_KEYS: Record<NicknameProblem, string> = {
  too_short: 'onboarding.nicknameTooShort',
  too_long: 'onboarding.nicknameTooLong',
  bad_chars: 'onboarding.nicknameBadChars',
}

const FAILURE_KEYS: Record<OnboardingFailure, string> = {
  nickname_taken: 'onboarding.nicknameTaken',
  nickname_invalid: 'onboarding.nicknameBadChars',
  unknown: 'app.error',
}

export function NicknameEditor({ nickname, onChange }: { nickname: string; onChange: () => void }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(nickname)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const problem = checkNickname(value)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (problem || busy) return
    setBusy(true)
    setError(null)
    const result = await changeNickname(value.trim())
    setBusy(false)
    if (result.ok) {
      setEditing(false)
      onChange()
      return
    }
    setError(t(FAILURE_KEYS[result.reason]))
  }

  if (!editing) {
    return (
      <button
        className="btn--link"
        type="button"
        onClick={() => {
          setValue(nickname)
          setError(null)
          setEditing(true)
        }}
      >
        {t('profile.changeNickname')}
      </button>
    )
  }

  return (
    <form className="stack card" onSubmit={onSubmit}>
      <label className="stack">
        <span>{t('onboarding.nicknameLabel')}</span>
        <input className="input" autoComplete="nickname" maxLength={30} value={value} onChange={(event) => setValue(event.target.value)} />
      </label>
      {problem ? <p className="error">{t(PROBLEM_KEYS[problem])}</p> : <p className="muted">{t('onboarding.nicknameHint')}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <button className="btn" type="submit" disabled={problem !== null || busy}>
          {t('profile.saveNickname')}
        </button>
        <button className="btn btn--ghost" type="button" onClick={() => setEditing(false)}>
          {t('profile.cancel')}
        </button>
      </div>
    </form>
  )
}
```

Utwórz `src/profile/DeleteAccount.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { signOut } from '../auth/authApi'
import { deleteAccount } from './accountApi'

export function DeleteAccount() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function remove() {
    setBusy(true)
    setFailed(false)
    const deleted = await deleteAccount()
    setBusy(false)
    if (!deleted) {
      setFailed(true)
      return
    }
    // Konto już nie istnieje — czyścimy lokalną sesję; aplikacja wraca do ekranu logowania.
    await signOut().catch(() => undefined)
  }

  if (!open) {
    return (
      <button className="btn btn--ghost" type="button" onClick={() => setOpen(true)}>
        {t('profile.deleteTitle')}
      </button>
    )
  }

  return (
    <section className="card stack">
      <strong>{t('profile.deleteTitle')}</strong>
      <p>{t('profile.deleteExplain')}</p>
      <label className="check">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <span>{t('profile.deleteConfirm')}</span>
      </label>
      {failed && (
        <p className="error" role="alert">
          {t('profile.deleteFailed')}
        </p>
      )}
      <button className="btn danger" type="button" disabled={!confirmed || busy} onClick={() => void remove()}>
        {t('profile.deleteForever')}
      </button>
      <button className="btn btn--ghost" type="button" onClick={() => setOpen(false)}>
        {t('profile.cancel')}
      </button>
    </section>
  )
}
```

Dopisz do `src/styles/base.css`:

```css
.btn.danger {
  background: var(--danger);
  color: #fff;
}
```

W `src/profile/ProfileScreen.tsx`:
- importy: `import { DeleteAccount } from './DeleteAccount'`, `import { NicknameEditor } from './NicknameEditor'`
- bezpośrednio po zamknięciu `</header>` wstaw `<NicknameEditor nickname={profile.nickname ?? ''} onChange={onChange} />`
- po przycisku wylogowania wstaw `<DeleteAccount />`

W `src/profile/ProfileScreen.test.tsx` i `src/App.test.tsx` dodaj do istniejących mocków `profileApi` funkcję `changeNickname: vi.fn()` oraz mock (w App ścieżka `'./profile/accountApi'`):

```tsx
vi.mock('./accountApi', () => ({ deleteAccount: vi.fn() }))
```

- [ ] **Step 5: Polityka prywatności**

W `src/legal/Privacy.tsx` zamień zdanie „Aby usunąć konto, napisz na {LEGAL.contactEmail}.” na:
„Konto możesz usunąć w Profilu przyciskiem „Usuń konto” — znikną wtedy wszystkie Twoje dane i zdjęcia (możesz też napisać na {LEGAL.contactEmail}).” (Polityka już mówi, że odrzucone zdjęcia usuwamy po 30 dniach — Task 3 to realizuje.)

W `src/legal/legalConfig.ts` ustaw `version: '2026-10-04'`.

- [ ] **Step 6: Uruchom testy, typy, lint i build**

Run: `npm test && npx tsc -b && npm run lint && npm run build`
Expected: wszystko przechodzi, 0 ostrzeżeń.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: nickname change and account deletion in profile; report limits in UI"
```

---

### Task 7: Testy E2E w prawdziwej przeglądarce (Playwright)

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/helpers.ts`, `tests/e2e/app.spec.ts`
- Modify: `package.json`, `.gitignore`, `README.md`

**Interfaces:**
- Consumes: cała aplikacja; lokalny Supabase (`npm run db:start`), Mailpit `http://127.0.0.1:54324`, funkcje (`npm run functions:serve`)
- Produces: skrypt `npm run e2e`

- [ ] **Step 1: Instalacja i konfiguracja**

```bash
npm install -D @playwright/test@1.63.0
npm pkg set scripts.e2e="playwright test"
```

(Wersja 1.63.0 używa Chromium 1243, który jest już w `~/.cache/ms-playwright` — nie trzeba niczego pobierać.)

Dopisz do `.gitignore`:

```
test-results/
playwright-report/
```

Utwórz `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

// E2E wymagają: npm run db:start oraz npm run functions:serve (w osobnym terminalu).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  workers: 1,
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:5173',
    locale: 'pl-PL',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
```

- [ ] **Step 2: Pomocnicy**

Utwórz `tests/e2e/helpers.ts`:

```ts
import { expect, type Page } from '@playwright/test'

const MAILPIT = 'http://127.0.0.1:54324'

interface MailpitMessage {
  ID: string
  Created: string
}

export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`
}

export function uniqueNickname(): string {
  return `E2E_${Date.now() % 100_000_000}`
}

async function latestCode(email: string, since: number): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const list = (await (await fetch(`${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(email)}`)).json()) as {
      messages?: MailpitMessage[]
    }
    const fresh = (list.messages ?? []).find((message) => Date.parse(message.Created) >= since - 2000)
    if (fresh) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json()) as { Text: string }
      const code = message.Text.match(/\b\d{6,10}\b/)?.[0]
      if (code) return code
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`Brak kodu logowania dla ${email}`)
}

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/')
  await page.getByLabel('Adres e-mail').fill(email)
  const since = Date.now()
  await page.getByRole('button', { name: 'Wyślij kod' }).click()
  await page.getByLabel('Kod z e-maila').fill(await latestCode(email, since))
  await page.getByRole('button', { name: 'Zaloguj', exact: true }).click()
}

export async function completeOnboarding(page: Page, nickname: string): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Witaj w szczurzej ekipie!' })).toBeVisible()
  await page.getByLabel('Twój pseudonim').fill(nickname)
  await page.getByRole('checkbox', { name: 'Mam ukończone 16 lat' }).check()
  await page.getByRole('checkbox', { name: 'Akceptuję regulamin i politykę prywatności' }).check()
  await page.getByRole('button', { name: 'Zaczynamy!' }).click()
  await expect(page.getByRole('button', { name: 'Mapa', exact: true })).toBeVisible()
}

export async function dismissInstallHint(page: Page): Promise<void> {
  const notNow = page.getByRole('button', { name: 'Nie teraz' })
  if (await notNow.isVisible()) await notNow.click()
}
```

- [ ] **Step 3: Scenariusze**

Utwórz `tests/e2e/app.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { completeOnboarding, dismissInstallHint, signIn, uniqueEmail, uniqueNickname } from './helpers'

test('nowa osoba loguje się kodem, przechodzi onboarding i widzi mapę', async ({ page }) => {
  await signIn(page, uniqueEmail())
  await completeOnboarding(page, uniqueNickname())
  await dismissInstallHint(page)
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('OpenFreeMap', { exact: false })).toBeVisible()
})

test('profil pokazuje osiągnięcia z sekretami i pustą listę zgłoszeń, a ranking się otwiera', async ({ page }) => {
  await signIn(page, uniqueEmail())
  await completeOnboarding(page, uniqueNickname())
  await dismissInstallHint(page)

  await page.getByRole('button', { name: 'Profil', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Osiągnięcia' })).toBeVisible()
  await expect(page.getByText('Zostało 7 sekretów do odkrycia')).toBeVisible()
  await expect(page.getByText('Nie masz jeszcze zgłoszeń. Czas na łowy! 🐀')).toBeVisible()

  await page.getByRole('button', { name: 'Ranking', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Ranking' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ten miesiąc' })).toHaveAttribute('aria-pressed', 'true')
})

test('zmiana pseudonimu i usunięcie konta', async ({ page }) => {
  const email = uniqueEmail()
  await signIn(page, email)
  await completeOnboarding(page, uniqueNickname())
  await dismissInstallHint(page)

  await page.getByRole('button', { name: 'Profil', exact: true }).click()
  const renamed = uniqueNickname()
  await page.getByRole('button', { name: 'Zmień pseudonim' }).click()
  await page.getByLabel('Twój pseudonim').fill(renamed)
  await page.getByRole('button', { name: 'Zapisz' }).click()
  await expect(page.getByRole('heading', { name: renamed })).toBeVisible()

  await page.getByRole('button', { name: 'Usuń konto' }).click()
  await page.getByRole('checkbox', { name: 'Rozumiem, że tego nie da się cofnąć' }).check()
  await page.getByRole('button', { name: 'Usuń konto na zawsze' }).click()
  await expect(page.getByRole('button', { name: 'Zaloguj przez Google' })).toBeVisible({ timeout: 30_000 })

  // Ten sam e-mail tworzy teraz zupełnie nowe konto — wraca onboarding.
  await signIn(page, email)
  await expect(page.getByRole('heading', { name: 'Witaj w szczurzej ekipie!' })).toBeVisible()
})
```

- [ ] **Step 4: Uruchom E2E**

W osobnym terminalu: `npm run db:start` (jeśli nie działa) i `npm run functions:serve` (zostaw uruchomione). Następnie:

Run: `npm run e2e`
Expected: `3 passed`. Zatrzymaj `functions:serve` po PID.

- [ ] **Step 5: README**

W `README.md` w sekcji „Uruchomienie lokalne” po linii z `npm run test:db` dodaj:

```bash
npm run e2e                       # testy w przeglądarce (wymagają db:start i functions:serve)
```

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts tests/e2e package.json package-lock.json .gitignore README.md
git commit -m "test: add Playwright end-to-end tests for login, onboarding, map, profile and account deletion"
```

---

### Task 8: Wdrożenie (kontroler, po przeglądzie i scaleniu)

- [ ] **Step 1:** `npx supabase db push` (migracje `20261004000000_achievements.sql`, `20261004000100_social.sql`).
- [ ] **Step 2:** `npx supabase functions deploy retry-pending delete-account`.
- [ ] **Step 3:** `npm run deploy`.
- [ ] **Step 4:** Sprawdzenie: `POST …/rest/v1/rpc/get_ranking` i `…/rpc/my_achievements` z kluczem publicznym bez logowania → `42501`; `POST …/functions/v1/delete-account` bez tokenu → `401`.
- [ ] **Step 5:** Właściciel: Profil → „Osiągnięcia” (7 sekretów do odkrycia), zakładka „Ranking”, „Zmień pseudonim”.
