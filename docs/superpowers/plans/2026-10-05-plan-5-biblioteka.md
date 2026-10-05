# Plan 5: Szczurza Biblioteka — implementacja

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raciki dostają sens: nowa zakładka „Biblioteka”, w której za raciki kupuje się karty wiedzy, quizy, skórki pinezek i tytuły przy pseudonimie; skórki i tytuły widzą inni na mapie i w rankingu.

**Architecture:** Katalog w tabeli `reward_items` (treść w `content` jsonb), zakupy w `user_rewards`; wszystko przez funkcje SQL `security definer` (katalog bez treści, treść tylko po zakupie, atomowy zakup z wpisem w dzienniku racików). Założona skórka/tytuł to kolumny `profiles.active_pin_skin` / `active_title`; `sightings_in_view` i `get_ranking` zwracają je dodatkowo. Frontend: moduł `src/library/` (API, parsery treści, widoki karty/quizu/wyglądu, ekran katalogu) i piąta zakładka.

**Tech Stack:** jak w planach 1–4 (React 19 + TS + Vite + Vitest, Supabase Postgres + pgTAP, Playwright 1.63).

**Spec:** [docs/superpowers/specs/2026-09-29-szczury-wroclaw-design.md](../specs/2026-09-29-szczury-wroclaw-design.md) — sekcje 5 (Nagrody), 8 (Szczurza Biblioteka), 17 (projekt planu 5 — wiążący przy rozbieżnościach)

**Poprzednie plany:** 1–4 zrealizowane; kod w repozytorium jest źródłem prawdy.

## Odstępstwa i decyzje (plan 5)

1. Ramki avatara pominięte (aplikacja nie ma avatarów); kody partnerów — etap 3.
2. Karta „Szczury w historii Wrocławia” zastąpiona kartą „Szczury w kulturze” — nie mamy sprawdzonych źródeł o historii szczurów we Wrocławiu; nie wymyślamy faktów.
3. Quizy nie dają racików; zapisujemy najlepszy wynik (`user_rewards.data.best_score`). Odpowiedzi quizu są w treści po zakupie — oszukanie poprawia tylko własny wynik.
4. Identyfikatory przedmiotów są tekstowe (`card_laugh`); dziennik racików dostaje kolumnę `item_id` (bo `ref_id` to uuid).
5. Paleta skórek pinezek jest w kodzie aplikacji (`PIN_SKINS`), a przedmiot ma tylko klucz skórki (`{"skin":"gold"}`).

## Global Constraints

- Nazwa: **Ratlas**; waluta w interfejsie: **raciki** (1 racik, 2 raciki, 5 racików — klucz `result.raciki`); w kodzie i bazie `tokens*`.
- Każdy widoczny tekst z `src/i18n/pl.json` (liczba mnoga `_one/_few/_many/_other`); teksty neutralne płciowo. Wyjątek: treść kart/quizów i nazwy przedmiotów żyją w bazie (`reward_items`).
- **Produkcja ma wyłączone „Automatically expose new tables”** — każda nowa tabela/funkcja: jawne `revoke`/`grant` + test pgTAP uprawnień.
- Raciki zmieniają wyłącznie funkcje SQL `security definer` (`search_path = ''`); użytkownik nie ma prawa zapisu do `reward_items`, `user_rewards`, `token_ledger`, `profiles.tokens_balance/active_*`.
- Ceny: karta wiedzy **30**, quiz **50**, tytuł **100–150**, skórka pinezki **200–300** racików.
- Treść karty i quizu trafia do aplikacji tylko po zakupie; katalog zwraca nazwę, zajawkę, cenę i (tylko dla wyglądu) podgląd.
- Naraz założona jedna skórka i jeden tytuł. Tytuł widać przy pseudonimie (ranking, panel pinezki) — na mapie tylko gdy pseudonim jest widoczny.
- Lokalny Supabase: tylko `npm run db:start` / `db:reset` / `test:db`; funkcje lokalnie `npm run functions:serve`.
- TypeScript: `import type`/inline `type`, bez `enum`, bez parameter properties; Vitest `mockReset: true`; `npm run lint` bez ostrzeżeń.
- Commity: `git -c user.email=michalpla05@gmail.com -c user.name=placik commit …`, stopka `Co-Authored-By:` z nazwą modelu.

## Struktura plików

```
supabase/migrations/20261005000000_library.sql            # tabele, kolumny profilu, funkcje Biblioteki
supabase/migrations/20261005000100_library_content.sql    # 10 kart, 3 quizy, 3 skórki, 3 tytuły
supabase/migrations/20261005000200_cosmetics_visible.sql  # skórka/tytuł w sightings_in_view i get_ranking
supabase/tests/library.test.sql, supabase/tests/library_content.test.sql
supabase/tests/map.test.sql, supabase/tests/social.test.sql   # + asercje skórki/tytułu
src/library/libraryApi.ts (+test), src/library/content.ts (+test), src/library/useItemContent.ts
src/library/ItemView.tsx, CardView.tsx, QuizView.tsx, CosmeticView.tsx (+ ItemView.test.tsx)
src/library/LibraryScreen.tsx (+test), src/library/library.css
src/map/ratIcons.ts (+test), src/map/pins.ts, src/map/mapApi.ts, src/map/MapView.tsx, src/map/PinPanel.tsx
src/ranking/rankingApi.ts, src/ranking/RankingScreen.tsx
src/shell/TabBar.tsx, src/shell/AppShell.tsx, src/shell/shell.css, src/main.tsx, src/i18n/pl.json
tests/e2e/helpers.ts, tests/e2e/library.spec.ts, docs/admin.md
```

---

### Task 1: Biblioteka w bazie (tabele i funkcje)

**Files:**
- Create: `supabase/migrations/20261005000000_library.sql`, `supabase/tests/library.test.sql`

**Interfaces:**
- Consumes: `profiles` (`tokens_balance` z check `>= 0`), `token_ledger` (reason `'purchase'` dozwolony)
- Produces:
  - `public.reward_items(id text pk, type text, name, teaser, price integer, content jsonb, sort_order smallint, active boolean)`; `type` ∈ `knowledge_card` | `quiz` | `pin_skin` | `title`
  - `public.user_rewards(user_id, item_id, acquired_at, data jsonb)`, pk (`user_id`, `item_id`)
  - `profiles.active_pin_skin text`, `profiles.active_title text` (FK do `reward_items`, `on delete set null`)
  - `token_ledger.item_id text` (FK do `reward_items`, `on delete set null`)
  - `public.library_catalog() returns table(id text, type text, name text, teaser text, price integer, sort_order smallint, preview text, owned boolean, equipped boolean)` — tylko aktywne; `preview` = `content->>'skin'` dla `pin_skin`, `content->>'label'` dla `title`, inaczej null
  - `public.purchase_item(p_item_id text) returns text` — `'purchased'` | `'owned'` | `'insufficient'` | `'not_found'`; `28000` niezalogowany
  - `public.get_item_content(p_item_id text) returns table(content jsonb, data jsonb)` — 1 wiersz, gdy przedmiot kupiony; inaczej 0 wierszy
  - `public.save_quiz_result(p_item_id text, p_score integer) returns integer` (najlepszy wynik) — `P0001 'not owned'`, `22023` zły wynik / nie quiz
  - `public.set_equipped(p_type text, p_item_id text) returns text` — `'ok'` | `'not_owned'` | `'invalid'`; `p_item_id` null zdejmuje
  - wszystkie 5 funkcji: execute tylko `authenticated`

- [ ] **Step 1: Napisz testy bazy**

Utwórz `supabase/tests/library.test.sql`:

```sql
begin;
select plan(24);

-- Testy działają na własnych przedmiotach (katalog startowy dochodzi w osobnej migracji).
delete from public.reward_items;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ala@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ola@example.com');
update public.profiles set tokens_balance = 100 where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set tokens_balance = 10 where id = '22222222-2222-2222-2222-222222222222';

insert into public.reward_items (id, type, name, teaser, price, content, sort_order, active) values
  ('t_card', 'knowledge_card', 'Karta', 'Zajawka', 30, '{"body":["Tekst"],"sources":[]}', 1, true),
  ('t_quiz', 'quiz', 'Quiz', 'Zajawka', 50,
   '{"questions":[{"question":"A?","answers":["a","b","c"],"correct":0,"explain":""},{"question":"B?","answers":["a","b","c"],"correct":1,"explain":""}]}', 2, true),
  ('t_skin', 'pin_skin', 'Skórka', 'Zajawka', 20, '{"skin":"gold"}', 3, true),
  ('t_title', 'title', 'Tytuł', 'Zajawka', 20, '{"label":"Tester"}', 4, true),
  ('t_old', 'knowledge_card', 'Stara', 'Zajawka', 5, '{}', 5, false);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- 1–2: katalog i ukryta treść
select is(
  (select array_agg(row(id, owned, equipped, preview)::text order by sort_order) from public.library_catalog()),
  array[
    row('t_card', false, false, null::text)::text,
    row('t_quiz', false, false, null::text)::text,
    row('t_skin', false, false, 'gold')::text,
    row('t_title', false, false, 'Tester')::text
  ],
  'katalog: tylko aktywne przedmioty, podgląd tylko dla wyglądu'
);
select is((select count(*)::int from public.get_item_content('t_card')), 0, 'treść karty niedostępna przed zakupem');

-- 3–7: zakup
select is(public.purchase_item('t_card'), 'purchased', 'zakup karty');
select is((select tokens_balance from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 70, 'saldo zmniejszone o cenę');
select is(
  (select row(delta, reason, item_id)::text from public.token_ledger
    where user_id = '11111111-1111-1111-1111-111111111111' and reason = 'purchase'),
  row(-30, 'purchase', 't_card')::text,
  'zakup jest w dzienniku racików'
);
select is(public.purchase_item('t_card'), 'owned', 'drugi zakup tego samego jest blokowany');
select is((select content -> 'body' ->> 0 from public.get_item_content('t_card')), 'Tekst', 'po zakupie treść jest dostępna');

-- 8–12: saldo i niedostępne przedmioty
select is(public.purchase_item('t_quiz'), 'purchased', 'zakup quizu');
select is(public.purchase_item('t_skin'), 'purchased', 'zakup skórki za ostatnie raciki');
select is(public.purchase_item('t_title'), 'insufficient', 'za mało racików');
select is((select tokens_balance from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 0, 'saldo nie spada poniżej zera');
select is(public.purchase_item('t_old'), 'not_found', 'nieaktywny przedmiot nie jest na sprzedaż');

-- 13–15: wynik quizu
select is(public.save_quiz_result('t_quiz', 1), 1, 'zapis wyniku quizu');
select is(public.save_quiz_result('t_quiz', 0), 1, 'zapamiętujemy najlepszy wynik');
select throws_ok($$ select public.save_quiz_result('t_quiz', 3) $$, '22023', null, 'wynik większy niż liczba pytań jest odrzucany');

-- 16–21: zakładanie wyglądu
select is(public.set_equipped('pin_skin', 't_skin'), 'ok', 'założenie kupionej skórki');
select is(public.set_equipped('title', 't_title'), 'not_owned', 'nie założysz niekupionego tytułu');
select is(public.set_equipped('title', 't_skin'), 'invalid', 'skórka nie jest tytułem');
select is(
  (select row(active_pin_skin, active_title)::text from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  row('t_skin', null::text)::text,
  'profil ma założoną skórkę'
);
select is((select equipped from public.library_catalog() where id = 't_skin'), true, 'katalog oznacza założony przedmiot');
select is(public.set_equipped('pin_skin', null), 'ok', 'zdjęcie skórki');

-- 22–23: cudze zakupy
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.get_item_content('t_card')), 0, 'cudzy zakup nie daje dostępu do treści');
select throws_ok($$ select public.save_quiz_result('t_quiz', 1) $$, 'P0001', 'not owned', 'wynik zapisze tylko osoba z quizem');

-- 24: uprawnienia
reset role;
select ok(
  has_function_privilege('authenticated', 'public.library_catalog()', 'execute')
  and has_function_privilege('authenticated', 'public.purchase_item(text)', 'execute')
  and has_function_privilege('authenticated', 'public.get_item_content(text)', 'execute')
  and has_function_privilege('authenticated', 'public.save_quiz_result(text,integer)', 'execute')
  and has_function_privilege('authenticated', 'public.set_equipped(text,text)', 'execute')
  and not has_function_privilege('anon', 'public.purchase_item(text)', 'execute')
  and not has_function_privilege('anon', 'public.library_catalog()', 'execute')
  and not has_table_privilege('authenticated', 'public.reward_items', 'select')
  and not has_table_privilege('authenticated', 'public.user_rewards', 'select')
  and not has_column_privilege('authenticated', 'public.profiles', 'active_title', 'update'),
  'Biblioteka dostępna tylko przez funkcje'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Uruchom testy i sprawdź, że nie przechodzą**

Run: `npm run test:db`
Expected: FAIL w `library.test.sql` (brak `public.reward_items`).

- [ ] **Step 3: Migracja**

Utwórz `supabase/migrations/20261005000000_library.sql`:

```sql
-- Szczurza Biblioteka: katalog nagród, zakupy za raciki, założony wygląd.
-- Produkcja ma wyłączone automatyczne udostępnianie — uprawnienia nadajemy jawnie.

create table public.reward_items (
  id text primary key,
  type text not null check (type in ('knowledge_card', 'quiz', 'pin_skin', 'title')),
  name text not null,
  teaser text not null,
  price integer not null check (price > 0),
  content jsonb not null default '{}',
  sort_order smallint not null unique,
  active boolean not null default true
);

alter table public.reward_items enable row level security;
revoke all on public.reward_items from anon, authenticated;

create table public.user_rewards (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.reward_items (id) on delete cascade,
  acquired_at timestamptz not null default now(),
  data jsonb not null default '{}',
  primary key (user_id, item_id)
);

alter table public.user_rewards enable row level security;
revoke all on public.user_rewards from anon, authenticated;

alter table public.profiles
  add column active_pin_skin text references public.reward_items (id) on delete set null,
  add column active_title text references public.reward_items (id) on delete set null;

-- Zakupy mają tekstowy identyfikator przedmiotu (ref_id to uuid zgłoszenia).
alter table public.token_ledger
  add column item_id text references public.reward_items (id) on delete set null;

create function public.library_catalog()
returns table (
  id text,
  type text,
  name text,
  teaser text,
  price integer,
  sort_order smallint,
  preview text,
  owned boolean,
  equipped boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Bez treści kart i quizów: te trafiają do aplikacji dopiero po zakupie (get_item_content).
  select i.id,
         i.type,
         i.name,
         i.teaser,
         i.price,
         i.sort_order,
         case i.type when 'pin_skin' then i.content ->> 'skin' when 'title' then i.content ->> 'label' end,
         ur.item_id is not null,
         coalesce(i.id = p.active_pin_skin or i.id = p.active_title, false)
    from public.reward_items i
    left join public.user_rewards ur on ur.item_id = i.id and ur.user_id = (select auth.uid())
    left join public.profiles p on p.id = (select auth.uid())
   where i.active
   order by i.sort_order
$$;

create function public.purchase_item(p_item_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_price integer;
  v_balance integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select price into v_price from public.reward_items where id = p_item_id and active;
  if v_price is null then
    return 'not_found';
  end if;

  -- Blokada profilu szereguje równoległe zakupy tej samej osoby.
  select tokens_balance into v_balance from public.profiles where id = v_user for update;

  if exists (select 1 from public.user_rewards where user_id = v_user and item_id = p_item_id) then
    return 'owned';
  end if;
  if v_balance < v_price then
    return 'insufficient';
  end if;

  insert into public.user_rewards (user_id, item_id) values (v_user, p_item_id);
  insert into public.token_ledger (user_id, delta, reason, item_id) values (v_user, -v_price, 'purchase', p_item_id);
  update public.profiles set tokens_balance = tokens_balance - v_price where id = v_user;
  return 'purchased';
end;
$$;

create function public.get_item_content(p_item_id text)
returns table (content jsonb, data jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select i.content, ur.data
    from public.user_rewards ur
    join public.reward_items i on i.id = ur.item_id
   where ur.user_id = (select auth.uid())
     and ur.item_id = p_item_id
$$;

create function public.save_quiz_result(p_item_id text, p_score integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_questions integer;
  v_best integer;
begin
  select jsonb_array_length(i.content -> 'questions') into v_questions
    from public.user_rewards ur
    join public.reward_items i on i.id = ur.item_id
   where ur.user_id = auth.uid()
     and ur.item_id = p_item_id
     and i.type = 'quiz';

  if v_questions is null then
    raise exception 'not owned' using errcode = 'P0001';
  end if;
  if p_score is null or p_score < 0 or p_score > v_questions then
    raise exception 'invalid score' using errcode = '22023';
  end if;

  update public.user_rewards
     set data = jsonb_set(data, '{best_score}', to_jsonb(greatest(coalesce((data ->> 'best_score')::integer, 0), p_score)))
   where user_id = auth.uid() and item_id = p_item_id
  returning (data ->> 'best_score')::integer into v_best;

  return v_best;
end;
$$;

create function public.set_equipped(p_type text, p_item_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_type not in ('pin_skin', 'title') then
    return 'invalid';
  end if;

  if p_item_id is not null then
    if not exists (select 1 from public.reward_items where id = p_item_id and type = p_type) then
      return 'invalid';
    end if;
    if not exists (select 1 from public.user_rewards where user_id = v_user and item_id = p_item_id) then
      return 'not_owned';
    end if;
  end if;

  if p_type = 'pin_skin' then
    update public.profiles set active_pin_skin = p_item_id where id = v_user;
  else
    update public.profiles set active_title = p_item_id where id = v_user;
  end if;
  return 'ok';
end;
$$;

revoke execute on function public.library_catalog() from public, anon, authenticated;
revoke execute on function public.purchase_item(text) from public, anon, authenticated;
revoke execute on function public.get_item_content(text) from public, anon, authenticated;
revoke execute on function public.save_quiz_result(text, integer) from public, anon, authenticated;
revoke execute on function public.set_equipped(text, text) from public, anon, authenticated;

grant execute on function public.library_catalog() to authenticated;
grant execute on function public.purchase_item(text) to authenticated;
grant execute on function public.get_item_content(text) to authenticated;
grant execute on function public.save_quiz_result(text, integer) to authenticated;
grant execute on function public.set_equipped(text, text) to authenticated;
```

- [ ] **Step 4: Zastosuj migrację i uruchom testy**

Run: `npm run db:reset && npm run test:db`
Expected: `Result: PASS` (library.test.sql: 24). Jeśli inny plik testów liczy kolumny `profiles`/`token_ledger` albo klucze, popraw tylko liczbę i opisz to w raporcie.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261005000000_library.sql supabase/tests/library.test.sql
git commit -m "feat: add library catalog, purchases and equipped cosmetics in database"
```

---

### Task 2: Katalog startowy (treść)

**Files:**
- Create: `supabase/migrations/20261005000100_library_content.sql`, `supabase/tests/library_content.test.sql`

**Interfaces:**
- Consumes: `public.reward_items` (Task 1)
- Produces: przedmioty o id: karty `card_species`, `card_laugh`, `card_health`, `card_swim`, `card_teeth`, `card_senses`, `card_herorats`, `card_empathy`, `card_culture`, `card_family`; quizy `quiz_body`, `quiz_mind`, `quiz_people`; skórki `pin_gold`, `pin_night`, `pin_sewer` (content `{"skin": "gold" | "night" | "sewer"}`); tytuły `title_detective`, `title_trash`, `title_odra` (content `{"label": …}`)
- Format treści: karta `{"body": [akapity], "sources": [{"label", "url"}]}`; quiz `{"questions": [{"question", "answers": [≥3], "correct": indeks od 0, "explain"}]}`

- [ ] **Step 1: Napisz test katalogu**

Utwórz `supabase/tests/library_content.test.sql`:

```sql
begin;
select plan(7);

select is(
  (select array_agg(row(type, n)::text order by type)
     from (select type, count(*)::int as n from public.reward_items where active group by type) x),
  array[row('knowledge_card', 10)::text, row('pin_skin', 3)::text, row('quiz', 3)::text, row('title', 3)::text],
  'katalog startowy: 10 kart, 3 quizy, 3 skórki, 3 tytuły'
);
select is(
  (select count(*)::int from public.reward_items where not (
     (type = 'knowledge_card' and price = 30)
     or (type = 'quiz' and price = 50)
     or (type = 'title' and price between 100 and 150)
     or (type = 'pin_skin' and price between 200 and 300))),
  0,
  'ceny zgodne ze specyfikacją'
);
select is(
  (select count(*)::int from public.reward_items
    where type = 'knowledge_card'
      and (jsonb_array_length(content -> 'body') < 2 or jsonb_array_length(content -> 'sources') < 1)),
  0,
  'każda karta ma co najmniej 2 akapity i źródło'
);
select is(
  (select count(*)::int from public.reward_items r, jsonb_array_elements(r.content -> 'sources') s
    where r.type = 'knowledge_card' and (s ->> 'url' not like 'https://%' or coalesce(s ->> 'label', '') = '')),
  0,
  'źródła mają opis i adres https'
);
select is(
  (select count(*)::int from public.reward_items where type = 'quiz' and jsonb_array_length(content -> 'questions') <> 5),
  0,
  'każdy quiz ma 5 pytań'
);
select is(
  (select count(*)::int from public.reward_items r, jsonb_array_elements(r.content -> 'questions') q
    where r.type = 'quiz'
      and (jsonb_array_length(q -> 'answers') < 3
           or (q ->> 'correct')::int < 0
           or (q ->> 'correct')::int >= jsonb_array_length(q -> 'answers')
           or coalesce(q ->> 'question', '') = ''
           or coalesce(q ->> 'explain', '') = '')),
  0,
  'pytania mają treść, wyjaśnienie, min. 3 odpowiedzi i poprawny indeks'
);
select is(
  (select count(*)::int from public.reward_items
    where (type = 'pin_skin' and coalesce(content ->> 'skin', '') not in ('gold', 'night', 'sewer'))
       or (type = 'title' and coalesce(content ->> 'label', '') = '')),
  0,
  'skórki mają klucz znany aplikacji, tytuły mają etykietę'
);

select * from finish();
rollback;
```

Run: `npm run test:db`
Expected: FAIL w `library_content.test.sql` (pusty katalog).

- [ ] **Step 2: Migracja z treścią**

Utwórz `supabase/migrations/20261005000100_library_content.sql` (treść dokładnie jak niżej — fakty sprawdzone; przy zmianach zachowaj źródła):

```sql
-- Katalog startowy Szczurzej Biblioteki. Teksty własne, ze źródłami; przed publicznym startem do przeczytania przez właściciela.

insert into public.reward_items (id, type, name, teaser, price, sort_order, content) values
('card_species', 'knowledge_card', 'Szczur wędrowny i szczur śniady', 'Który szczur mieszka we Wrocławiu?', 30, 1, $j${
  "body": [
    "W polskich miastach niemal zawsze spotkasz szczura wędrownego (Rattus norvegicus), zwanego też brunatnym. Jest krępy, ma tępo zakończony pysk, małe uszy i ogon krótszy niż reszta ciała. Dorosły waży zwykle od 200 do 500 gramów.",
    "Szczur śniady (Rattus rattus) jest smuklejszy, ma duże uszy i ogon dłuższy niż ciało. Świetnie się wspina i chętniej mieszka na strychach niż w piwnicach. W Europie Środkowej szczur wędrowny w dużej mierze go wyparł, więc dziś jest u nas rzadki.",
    "Mimo łacińskiej nazwy „norvegicus” szczur wędrowny nie pochodzi z Norwegii. Badania genetyczne wskazują na Azję Wschodnią, skąd razem z ludźmi rozprzestrzenił się po całym świecie."
  ],
  "sources": [
    {"label": "Wikipedia: Szczur wędrowny", "url": "https://pl.wikipedia.org/wiki/Szczur_wędrowny"},
    {"label": "Wikipedia: Szczur śniady", "url": "https://pl.wikipedia.org/wiki/Szczur_śniady"}
  ]
}$j$::jsonb),
('card_laugh', 'knowledge_card', 'Czy szczury się śmieją?', 'Łaskotanie w laboratorium', 30, 2, $j${
  "body": [
    "Na swój sposób tak. Neurobiolog Jaak Panksepp odkrył, że łaskotane szczury wydają krótkie piski o częstotliwości około 50 kHz, których ludzkie ucho nie słyszy. Nazwał je „szczurzym śmiechem”.",
    "Łaskotane szczury chętnie wracają do ręki, która je łaskotała. W 2016 roku badacze z Berlina pokazali, że za ten „śmiech” odpowiada konkretny obszar kory mózgowej. Szczury „śmieją się” też podczas zabawy z innymi szczurami.",
    "To nie powód, żeby łaskotać dzikie szczury! Dzikie zwierzę może ugryźć i przenosić choroby — fotografuj z dystansu."
  ],
  "sources": [
    {"label": "Panksepp i Burgdorf (2003), Physiology & Behavior", "url": "https://doi.org/10.1016/S0031-9384(03)00159-8"},
    {"label": "Ishiyama i Brecht (2016), Science", "url": "https://doi.org/10.1126/science.aah5114"}
  ]
}$j$::jsonb),
('card_health', 'knowledge_card', 'Szczury a zdrowie', 'Dlaczego nie dotykamy szczurów', 30, 3, $j${
  "body": [
    "Dzikie szczury mogą przenosić choroby groźne dla ludzi. Jedną z nich jest leptospiroza: bakterie Leptospira są wydalane z moczem zwierząt, a człowiek może się zarazić przez skaleczoną skórę lub błony śluzowe, na przykład przy kontakcie ze skażoną wodą lub ziemią.",
    "Szczury mogą też przenosić między innymi hantawirusy i bakterie Salmonella. Dlatego zasady są proste: nie dotykaj szczurów ani ich odchodów, nie wchodź do kanałów, a po sprzątaniu piwnicy czy pracy w ogrodzie dokładnie myj ręce.",
    "Jeśli po kontakcie z wodą, w której mogły być szczury, pojawi się gorączka albo bóle mięśni i głowy, powiedz lekarzowi o tym kontakcie."
  ],
  "sources": [
    {"label": "Wikipedia: Leptospiroza", "url": "https://pl.wikipedia.org/wiki/Leptospiroza"},
    {"label": "Wikipedia: Brown rat (choroby)", "url": "https://en.wikipedia.org/wiki/Brown_rat"}
  ]
}$j$::jsonb),
('card_swim', 'knowledge_card', 'Mistrzowie pływania', 'Jak szczury radzą sobie z wodą', 30, 4, $j${
  "body": [
    "Szczury wędrowne bardzo dobrze pływają i nurkują. Potrafią przedostać się przez zalaną rurę i wspiąć się po jej ściankach, dlatego tak dobrze czują się w kanalizacji.",
    "Lubią miejsca blisko wody: nabrzeża, kanały i brzegi rzek. Wrocław z Odrą, jej odnogami i kanałami ma dla nich wyjątkowo dużo takich miejsc.",
    "Szczur przeciśnie się przez szczelinę niewiele większą niż jego głowa. Dlatego dziury w ścianach piwnic i wokół rur warto szczelnie zabezpieczać."
  ],
  "sources": [
    {"label": "Wikipedia: Brown rat", "url": "https://en.wikipedia.org/wiki/Brown_rat"}
  ]
}$j$::jsonb),
('card_teeth', 'knowledge_card', 'Zęby, które ciągle rosną', 'Dlaczego szczur wciąż coś gryzie', 30, 5, $j${
  "body": [
    "Jak wszystkie gryzonie, szczur ma cztery długie siekacze, które rosną przez całe życie. Gdyby się nie ścierały, urosłyby tak bardzo, że szczur nie mógłby jeść — dlatego ciągle coś gryzie.",
    "Pomarańczowy kolor zębów to nie brud: szkliwo siekaczy szczura zawiera żelazo, które czyni je twardszymi.",
    "Szczury przegryzają drewno, plastik, a nawet izolację kabli. To jedna z głównych przyczyn szkód, jakie wyrządzają w budynkach."
  ],
  "sources": [
    {"label": "Wikipedia: Gryzonie", "url": "https://pl.wikipedia.org/wiki/Gryzonie"},
    {"label": "Wikipedia: Rodent (zęby)", "url": "https://en.wikipedia.org/wiki/Rodent"}
  ]
}$j$::jsonb),
('card_senses', 'knowledge_card', 'Wąsy, nos i ultrafiolet', 'Jak szczur poznaje świat', 30, 6, $j${
  "body": [
    "Szczury nie widzą ostro, ale ich oczy rejestrują światło ultrafioletowe, którego ludzie nie widzą.",
    "Świat poznają głównie węchem i wąsami (wibrysami). Szybko poruszając wąsami, „omiatają” otoczenie i nawet w ciemności rozpoznają kształty i faktury.",
    "Węch gryzoni jest tak czuły, że afrykańskie szczury olbrzymie szkoli się do wyszukiwania min — o tym opowiada karta „Szczury bohaterowie”."
  ],
  "sources": [
    {"label": "Wikipedia: Brown rat (zmysły)", "url": "https://en.wikipedia.org/wiki/Brown_rat"},
    {"label": "Wikipedia: Whiskers", "url": "https://en.wikipedia.org/wiki/Whiskers"}
  ]
}$j$::jsonb),
('card_herorats', 'knowledge_card', 'Szczury bohaterowie', 'Gryzonie, które ratują ludzi', 30, 7, $j${
  "body": [
    "Organizacja APOPO z Tanzanii szkoli afrykańskie szczury olbrzymie do wyszukiwania min lądowych. Szczur jest za lekki, żeby zdetonować minę, a węchem przeszukuje teren znacznie szybciej niż człowiek z wykrywaczem metalu.",
    "Najsłynniejszy z nich, Magawa, wywęszył w Kambodży ponad 100 min i niewybuchów. W 2020 roku jako pierwszy szczur dostał złoty medal brytyjskiej organizacji PDSA za odwagę.",
    "Szczury APOPO uczą się też rozpoznawać po zapachu próbki, w których są bakterie gruźlicy."
  ],
  "sources": [
    {"label": "APOPO", "url": "https://apopo.org"},
    {"label": "Wikipedia: Magawa", "url": "https://en.wikipedia.org/wiki/Magawa"}
  ]
}$j$::jsonb),
('card_empathy', 'knowledge_card', 'Szczurza empatia', 'Eksperyment z uwięzionym kolegą', 30, 8, $j${
  "body": [
    "W 2011 roku badacze z Uniwersytetu w Chicago zamykali szczura w ciasnej rurce i obserwowali jego towarzysza z klatki. Wolny szczur uczył się otwierać drzwiczki i uwalniał uwięzionego kolegę, choć nie dostawał za to żadnej nagrody.",
    "Gdy obok stała druga rurka z czekoladą, szczury często i tak uwalniały kolegę, a potem dzieliły się z nim smakołykiem.",
    "Szczury to zwierzęta stadne: śpią przytulone, czyszczą sobie nawzajem futro i uczą się od siebie, co jest bezpieczne do jedzenia."
  ],
  "sources": [
    {"label": "Bartal, Decety i Mason (2011), Science", "url": "https://doi.org/10.1126/science.1210789"}
  ]
}$j$::jsonb),
('card_culture', 'knowledge_card', 'Szczury w kulturze', 'Od zodiaku po kuchnię w Paryżu', 30, 9, $j${
  "body": [
    "W chińskim zodiaku Szczur otwiera cykl dwunastu zwierząt. Według legendy wygrał wyścig, jadąc na grzbiecie wołu i zeskakując na metę tuż przed nim.",
    "Legenda o Szczurołapie z Hameln opowiada o grajku, który w 1284 roku wyprowadził z miasta szczury, a gdy mu nie zapłacono, także dzieci.",
    "Współczesny szczur ma też dobrą prasę: Remy z filmu animowanego „Ratatuj” (2007) marzył, by zostać szefem kuchni w Paryżu."
  ],
  "sources": [
    {"label": "Wikipedia: Szczurołap z Hameln", "url": "https://pl.wikipedia.org/wiki/Szczurołap_z_Hameln"},
    {"label": "Wikipedia: Chinese zodiac", "url": "https://en.wikipedia.org/wiki/Chinese_zodiac"},
    {"label": "Wikipedia: Ratatuj", "url": "https://pl.wikipedia.org/wiki/Ratatuj"}
  ]
}$j$::jsonb),
('card_family', 'knowledge_card', 'Szczurza rodzina', 'Dlaczego szczurów szybko przybywa', 30, 10, $j${
  "body": [
    "Samica szczura wędrownego jest w ciąży około trzech tygodni i rodzi zwykle od 6 do 12 młodych. Młode rodzą się ślepe i bez futra, a po kilku tygodniach są już samodzielne. W dobrych warunkach samica może mieć kilka miotów w roku.",
    "Dziki szczur żyje krótko — zwykle mniej niż rok. W domowej hodowli szczury dożywają 2–3 lat.",
    "Gdy szczury mają dużo jedzenia i kryjówek, ich liczba szybko rośnie. Najlepszy sposób na mniej szczurów w mieście to mniej łatwego jedzenia: zamknięte śmietniki i niewyrzucanie resztek na trawniki."
  ],
  "sources": [
    {"label": "Wikipedia: Brown rat (rozmnażanie)", "url": "https://en.wikipedia.org/wiki/Brown_rat"}
  ]
}$j$::jsonb),
('quiz_body', 'quiz', 'Quiz: ciało i gatunki', '5 pytań o to, jak zbudowany jest szczur', 50, 11, $j${
  "questions": [
    {"question": "Który szczur najczęściej żyje w polskich miastach?", "answers": ["Szczur śniady", "Szczur wędrowny", "Szczur olbrzymi"], "correct": 1, "explain": "Szczur wędrowny (brunatny) w dużej mierze wyparł u nas szczura śniadego."},
    {"question": "Po czym rozpoznasz szczura śniadego?", "answers": ["Ogon dłuższy niż ciało i duże uszy", "Krótki ogon i małe uszy", "Białe łapki"], "correct": 0, "explain": "Szczur śniady jest smukły, ma duże uszy i bardzo długi ogon."},
    {"question": "Dlaczego zęby szczura są pomarańczowe?", "answers": ["Od brudu", "Szkliwo zawiera żelazo", "Od jedzenia marchewki"], "correct": 1, "explain": "Żelazo w szkliwie barwi siekacze i czyni je twardszymi."},
    {"question": "Co się dzieje z siekaczami szczura przez całe życie?", "answers": ["Wypadają co roku", "Przestają rosnąć po roku", "Ciągle rosną"], "correct": 2, "explain": "Siekacze gryzoni rosną całe życie i ścierają się podczas gryzienia."},
    {"question": "Skąd pochodzi szczur wędrowny?", "answers": ["Z Norwegii", "Z Azji Wschodniej", "Z Ameryki Południowej"], "correct": 1, "explain": "Mimo nazwy „norvegicus” jego przodkowie żyli w Azji Wschodniej."}
  ]
}$j$::jsonb),
('quiz_mind', 'quiz', 'Quiz: szczurzy umysł i zmysły', '5 pytań o to, jak szczur myśli i czuje', 50, 12, $j${
  "questions": [
    {"question": "Jak brzmi „szczurzy śmiech”?", "answers": ["Jak głośne chichotanie", "To piski ok. 50 kHz, niesłyszalne dla ludzi", "Jak tupanie łapkami"], "correct": 1, "explain": "Łaskotane szczury piszczą w ultradźwiękach."},
    {"question": "Czym szczury poznają otoczenie w ciemności?", "answers": ["Wąsami i węchem", "Echolokacją jak nietoperze", "Wzrokiem w podczerwieni"], "correct": 0, "explain": "Wibrysy i nos to najważniejsze zmysły szczura."},
    {"question": "Jakie światło widzą szczury, a ludzie nie?", "answers": ["Podczerwień", "Ultrafiolet", "Żadne"], "correct": 1, "explain": "Oczy szczura rejestrują ultrafiolet."},
    {"question": "Co robiły wolne szczury w eksperymencie z 2011 roku?", "answers": ["Ignorowały uwięzionego kolegę", "Uwalniały uwięzionego kolegę", "Zjadały całą czekoladę same"], "correct": 1, "explain": "Uwalniały kolegę, nawet gdy obok czekała czekolada."},
    {"question": "Skąd szczur wie, co jest bezpieczne do jedzenia?", "answers": ["Uczy się od innych szczurów", "Rozpoznaje to po kolorze", "Wcale tego nie wie"], "correct": 0, "explain": "Szczury uczą się od siebie nawzajem, także tego, co jeść."}
  ]
}$j$::jsonb),
('quiz_people', 'quiz', 'Quiz: szczury i ludzie', '5 pytań o nasze wspólne sprawy', 50, 13, $j${
  "questions": [
    {"question": "Jak można zarazić się leptospirozą?", "answers": ["Przez kontakt skaleczonej skóry ze skażoną wodą", "Patrząc na szczura", "Przez telefon"], "correct": 0, "explain": "Bakterie są w moczu zwierząt i wnikają przez rany oraz błony śluzowe."},
    {"question": "Czym zajmują się szczury z organizacji APOPO?", "answers": ["Wykrywaniem min i gruźlicy", "Sprzątaniem kanałów", "Występami w cyrku"], "correct": 0, "explain": "Afrykańskie szczury olbrzymie węchem znajdują miny i bakterie gruźlicy."},
    {"question": "W którym roku według legendy Szczurołap wyprowadził szczury z Hameln?", "answers": ["1284", "1648", "1918"], "correct": 0, "explain": "Legenda umieszcza te wydarzenia w 1284 roku."},
    {"question": "Który znak otwiera chiński zodiak?", "answers": ["Smok", "Szczur", "Tygrys"], "correct": 1, "explain": "Szczur wygrał wyścig dzięki sprytowi i grzbietowi wołu."},
    {"question": "Co najlepiej ogranicza liczbę szczurów w mieście?", "answers": ["Dokarmianie ich chlebem", "Zamknięte śmietniki i brak resztek na trawnikach", "Głośna muzyka"], "correct": 1, "explain": "Mniej łatwego jedzenia oznacza mniej szczurów."}
  ]
}$j$::jsonb),
('pin_night', 'pin_skin', 'Nocny szczur', 'Ciemne futro na nocne łowy', 200, 21, '{"skin":"night"}'),
('pin_sewer', 'pin_skin', 'Kanałowy szczur', 'Zielonkawy odcień prosto z kanałów', 250, 22, '{"skin":"sewer"}'),
('pin_gold', 'pin_skin', 'Złoty szczur', 'Twoje pinezki lśnią złotem', 300, 23, '{"skin":"gold"}'),
('title_detective', 'title', 'Kanałowy Detektyw', 'Tytuł przy Twoim pseudonimie', 100, 31, '{"label":"Kanałowy Detektyw"}'),
('title_trash', 'title', 'Postrach Śmietników', 'Tytuł przy Twoim pseudonimie', 120, 32, '{"label":"Postrach Śmietników"}'),
('title_odra', 'title', 'Wilk znad Odry', 'Tytuł przy Twoim pseudonimie', 150, 33, '{"label":"Wilk znad Odry"}');
```

- [ ] **Step 3: Zastosuj migrację i uruchom testy**

Run: `npm run db:reset && npm run test:db`
Expected: `Result: PASS` (library_content.test.sql: 7; library.test.sql nadal 24 — usuwa katalog na czas testu).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261005000100_library_content.sql supabase/tests/library_content.test.sql
git commit -m "feat: seed library with knowledge cards, quizzes and cosmetics"
```

---

### Task 3: Skórki i tytuły widoczne dla innych (baza)

**Files:**
- Create: `supabase/migrations/20261005000200_cosmetics_visible.sql`
- Modify: `supabase/tests/map.test.sql`, `supabase/tests/social.test.sql`

**Interfaces:**
- Consumes: `profiles.active_pin_skin`, `profiles.active_title`, `reward_items.content` (Task 1–2); obecne definicje `sightings_in_view` (`supabase/migrations/20261001000400_map.sql`) i `get_ranking` (`supabase/migrations/20261004000100_social.sql`)
- Produces:
  - `sightings_in_view(...)` zwraca dodatkowo `skin text` (klucz skórki właściciela lub null) i `title text` (etykieta tytułu, tylko gdy pseudonim widoczny na mapie)
  - `get_ranking(p_period)` zwraca dodatkowo `title text`
  - uprawnienia jak wcześniej (execute tylko `authenticated`)

- [ ] **Step 1: Napisz testy**

W `supabase/tests/map.test.sql`: zwiększ liczbę w `select plan(…)` o 2 i bezpośrednio przed `select * from finish();` dodaj:

```sql
-- Skórka i tytuł właściciela pinezki
reset role;
insert into public.reward_items (id, type, name, teaser, price, content, sort_order) values
  ('t_map_skin', 'pin_skin', 'Test', 't', 10, '{"skin":"gold"}', 901),
  ('t_map_title', 'title', 'Test', 't', 10, '{"label":"Tester"}', 902);
update public.profiles set active_pin_skin = 't_map_skin', active_title = 't_map_title'
 where id = '22222222-2222-2222-2222-222222222222';
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select is(
  (select row(skin, title)::text from public.sightings_in_view(16.8, 51.0, 17.2, 51.25) where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  row('gold', null::text)::text,
  'pinezka ma skórkę właściciela; tytuł jest ukryty razem z pseudonimem'
);
reset role;
update public.profiles set show_nickname_on_map = true where id = '22222222-2222-2222-2222-222222222222';
set local role authenticated;
select is(
  (select title from public.sightings_in_view(16.8, 51.0, 17.2, 51.25) where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  'Tester',
  'tytuł widać przy widocznym pseudonimie'
);
```

W `supabase/tests/social.test.sql`: zwiększ liczbę w `select plan(…)` o 1 i bezpośrednio przed `select * from finish();` dodaj:

```sql
-- Tytuł w rankingu
reset role;
insert into public.reward_items (id, type, name, teaser, price, content, sort_order) values
  ('t_rank_title', 'title', 'Test', 't', 10, '{"label":"Tester"}', 903);
update public.profiles set active_title = 't_rank_title' where id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select is(
  (select array_agg(row(is_me, title)::text order by is_me) from public.get_ranking('all')),
  array[row(false, null::text)::text, row(true, 'Tester')::text],
  'ranking pokazuje tytuł założony przez osobę (Ola bez tytułu, Ala z tytułem)'
);
```

Run: `npm run test:db`
Expected: FAIL (brak kolumn `skin`/`title`).

- [ ] **Step 2: Migracja**

Utwórz `supabase/migrations/20261005000200_cosmetics_visible.sql`. Zmiana listy kolumn wymaga `drop function` — ciała funkcji przepisz **dokładnie** z obecnych migracji, dodając tylko nowe kolumny:

```sql
-- Skórka pinezki i tytuł właściciela widoczne na mapie i w rankingu.
-- Zmiana zwracanych kolumn wymaga ponownego utworzenia funkcji i nadania uprawnień.

drop function public.sightings_in_view(double precision, double precision, double precision, double precision);

create function public.sightings_in_view(
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision
)
returns table (
  id uuid,
  lon double precision,
  lat double precision,
  rats integer,
  created_at timestamptz,
  photo_path text,
  nickname text,
  is_mine boolean,
  skin text,
  title text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id,
         extensions.st_x(s.location::extensions.geometry),
         extensions.st_y(s.location::extensions.geometry),
         least(coalesce(s.rats_detected, 0), public.config_int('max_rats_per_photo')),
         s.created_at,
         s.photo_path,
         case when p.show_nickname_on_map then p.nickname end,
         s.user_id = (select auth.uid()),
         skin_item.content ->> 'skin',
         case when p.show_nickname_on_map then title_item.content ->> 'label' end
    from public.sightings s
    join public.profiles p on p.id = s.user_id
    left join public.reward_items skin_item on skin_item.id = p.active_pin_skin
    left join public.reward_items title_item on title_item.id = p.active_title
   where s.status in ('accepted', 'accepted_no_points')
     and s.public_on_map
     and not s.hidden
     and s.created_at > now() - make_interval(days => public.config_int('pin_fade_days'))
     and s.photo_bucket = 'map-photos'
     and extensions.st_intersects(
           s.location::extensions.geometry,
           extensions.st_makeenvelope(greatest(p_west, -180), greatest(p_south, -90), least(p_east, 180), least(p_north, 90), 4326)
         )
   order by s.created_at desc
   limit 500
$$;

revoke execute on function public.sightings_in_view(double precision, double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.sightings_in_view(double precision, double precision, double precision, double precision) to authenticated;

drop function public.get_ranking(text);

create function public.get_ranking(p_period text)
returns table (place bigint, nickname text, rats bigint, is_me boolean, title text)
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
       and not s.hidden
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
  select r.place, p.nickname, r.rats, r.user_id = (select auth.uid()), title_item.content ->> 'label'
    from ranked r
    join public.profiles p on p.id = r.user_id
    left join public.reward_items title_item on title_item.id = p.active_title
   where r.place <= 50 or r.user_id = (select auth.uid())
   order by r.place
$$;

revoke execute on function public.get_ranking(text) from public, anon, authenticated;
grant execute on function public.get_ranking(text) to authenticated;
```

Przed zapisaniem porównaj ciała z obecnymi definicjami (`sed -n '/create function public.sightings_in_view/,/^\$\$;/p' supabase/migrations/20261001000400_map.sql` i `get_ranking` w `20261004000100_social.sql`) — różnić mogą się tylko nowe kolumny i złączenia.

- [ ] **Step 3: Uruchom testy**

Run: `npm run db:reset && npm run test:db`
Expected: `Result: PASS`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261005000200_cosmetics_visible.sql supabase/tests/map.test.sql supabase/tests/social.test.sql
git commit -m "feat: expose equipped pin skin and title on map and ranking"
```

---

### Task 4: Widoki przedmiotów Biblioteki (karta, quiz, wygląd)

**Files:**
- Create: `src/library/libraryApi.ts`, `src/library/libraryApi.test.ts`, `src/library/content.ts`, `src/library/content.test.ts`, `src/library/useItemContent.ts`, `src/library/ItemView.tsx`, `src/library/CardView.tsx`, `src/library/QuizView.tsx`, `src/library/CosmeticView.tsx`, `src/library/ItemView.test.tsx`, `src/map/ratIcons.test.ts`
- Modify: `src/map/ratIcons.ts`, `src/i18n/pl.json`

**Interfaces:**
- Consumes: RPC z Task 1 (`library_catalog`, `purchase_item`, `get_item_content`, `save_quiz_result`, `set_equipped`); format treści z Task 2
- Produces:
  - `libraryApi.ts`: `type ItemType = 'knowledge_card' | 'quiz' | 'pin_skin' | 'title'`; `interface CatalogItem { id: string; type: ItemType; name: string; teaser: string; price: number; preview: string | null; owned: boolean; equipped: boolean }`; `type PurchaseResult = 'purchased' | 'owned' | 'insufficient' | 'not_found' | 'error'`; `type EquipResult = 'ok' | 'not_owned' | 'invalid' | 'error'`; `interface ItemContent { content: unknown; data: Record<string, unknown> }`; `fetchCatalog(): Promise<CatalogItem[]>` (rzuca), `purchaseItem(id: string): Promise<PurchaseResult>`, `fetchItemContent(id: string): Promise<ItemContent | null>` (rzuca), `saveQuizResult(id: string, score: number): Promise<number | null>`, `setEquipped(type: 'pin_skin' | 'title', id: string | null): Promise<EquipResult>`
  - `content.ts`: `interface KnowledgeCard { body: string[]; sources: { label: string; url: string }[] }`, `interface QuizQuestion { question: string; answers: string[]; correct: number; explain: string }`, `parseCard(content: unknown): KnowledgeCard | null`, `parseQuiz(content: unknown): QuizQuestion[] | null`, `scoreQuiz(questions: QuizQuestion[], picks: number[]): number`
  - `ratIcons.ts`: `interface PinSkin { fill: string; stroke: string; eye: string }`, `PIN_SKINS: Record<string, PinSkin>` (klucze `default`, `gold`, `night`, `sewer`), `skinOrDefault(skin: string | null | undefined): string`, `ratIconSvg(skin: string, mine: boolean): string`; dotychczasowe `RAT_ICON_SVG`, `RAT_MINE_ICON_SVG`, `svgToImage` zostają (bez zmiany wyglądu)
  - `ItemView({ item, onBack, onChanged }: { item: CatalogItem; onBack: () => void; onChanged: () => void })`

- [ ] **Step 1: Teksty**

Dodaj do `src/i18n/pl.json` (skryptem JSON, 2 spacje, UTF-8) sekcję najwyższego poziomu:

```json
  "library": {
    "title": "Szczurza Biblioteka",
    "balance": "Masz {{raciki}}",
    "sections": { "cards": "Karty wiedzy", "quizzes": "Quizy", "looks": "Wygląd" },
    "owned": "Masz ✓",
    "equipped": "Założone",
    "buyConfirm": "Kupić „{{name}}” za {{raciki}}?",
    "buy": "Kup",
    "cancel": "Anuluj",
    "missing": "Brakuje Ci {{raciki}}. Zgłaszaj szczury, żeby zebrać więcej.",
    "purchaseResult": {
      "owned": "Ten przedmiot już masz.",
      "insufficient": "Masz za mało racików.",
      "not_found": "Tego przedmiotu nie ma już w Bibliotece.",
      "error": "Nie udało się kupić. Spróbuj ponownie."
    },
    "loadFailed": "Nie udało się wczytać Biblioteki.",
    "back": "← Wróć do Biblioteki",
    "sources": "Źródła",
    "contentFailed": "Nie udało się wczytać treści.",
    "quiz": {
      "progress": "Pytanie {{n}} z {{total}}",
      "correct": "Dobrze!",
      "wrong": "Niestety nie.",
      "next": "Dalej",
      "finish": "Zobacz wynik",
      "score": "Twój wynik: {{score}} z {{total}}",
      "best": "Najlepszy wynik: {{best}} z {{total}}",
      "again": "Jeszcze raz"
    },
    "cosmetic": {
      "equip": "Załóż",
      "unequip": "Zdejmij",
      "equippedNow": "Masz to na sobie.",
      "skinHint": "Tak zobaczą Twoje pinezki inne osoby na mapie.",
      "titleHint": "Tytuł pokazuje się przy Twoim pseudonimie w rankingu i na mapie.",
      "titlePreview": "„{{title}}”",
      "equipFailed": "Nie udało się zmienić wyglądu."
    }
  }
```

- [ ] **Step 2: Napisz testy**

Utwórz `src/library/content.test.ts`:

```ts
import { expect, test } from 'vitest'
import { parseCard, parseQuiz, scoreQuiz } from './content'

test('odczytuje kartę wiedzy i odrzuca złą treść', () => {
  expect(parseCard({ body: ['A', 'B'], sources: [{ label: 'Źródło', url: 'https://x.pl' }] })).toEqual({
    body: ['A', 'B'],
    sources: [{ label: 'Źródło', url: 'https://x.pl' }],
  })
  expect(parseCard({ body: 'A' })).toBeNull()
  expect(parseCard(null)).toBeNull()
  expect(parseCard({ body: ['A'], sources: [{ label: 'x', url: 'javascript:alert(1)' }] })).toEqual({ body: ['A'], sources: [] })
})

test('odczytuje quiz i odrzuca pytania z błędnym indeksem', () => {
  const question = { question: 'Q?', answers: ['a', 'b', 'c'], correct: 2, explain: 'Bo tak.' }
  expect(parseQuiz({ questions: [question] })).toEqual([question])
  expect(parseQuiz({ questions: [{ ...question, correct: 3 }] })).toBeNull()
  expect(parseQuiz({ questions: [] })).toBeNull()
  expect(parseQuiz({})).toBeNull()
})

test('liczy poprawne odpowiedzi', () => {
  const questions = [
    { question: '1', answers: ['a', 'b', 'c'], correct: 0, explain: '' },
    { question: '2', answers: ['a', 'b', 'c'], correct: 1, explain: '' },
    { question: '3', answers: ['a', 'b', 'c'], correct: 2, explain: '' },
  ]
  expect(scoreQuiz(questions, [0, 1, 0])).toBe(2)
  expect(scoreQuiz(questions, [])).toBe(0)
})
```

Utwórz `src/library/libraryApi.test.ts`:

```ts
import { expect, test, vi } from 'vitest'
import { fetchCatalog, fetchItemContent, purchaseItem, saveQuizResult, setEquipped } from './libraryApi'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

test('pobiera katalog', async () => {
  mocks.rpc.mockResolvedValue({
    data: [{ id: 'card_laugh', type: 'knowledge_card', name: 'Czy szczury się śmieją?', teaser: 'Łaskotanie', price: 30, sort_order: 2, preview: null, owned: false, equipped: false }],
    error: null,
  })
  expect(await fetchCatalog()).toEqual([
    { id: 'card_laugh', type: 'knowledge_card', name: 'Czy szczury się śmieją?', teaser: 'Łaskotanie', price: 30, preview: null, owned: false, equipped: false },
  ])
  expect(mocks.rpc).toHaveBeenCalledWith('library_catalog')
})

test.each([
  [{ data: 'purchased', error: null }, 'purchased'],
  [{ data: 'insufficient', error: null }, 'insufficient'],
  [{ data: 'dziwne', error: null }, 'error'],
  [{ data: null, error: new Error('offline') }, 'error'],
])('zakup: %o → %s', async (response, expected) => {
  mocks.rpc.mockResolvedValue(response)
  expect(await purchaseItem('card_laugh')).toBe(expected)
  expect(mocks.rpc).toHaveBeenCalledWith('purchase_item', { p_item_id: 'card_laugh' })
})

test('treść przedmiotu: kupiony i niekupiony', async () => {
  mocks.rpc.mockResolvedValueOnce({ data: [{ content: { body: ['A'] }, data: { best_score: 3 } }], error: null })
  expect(await fetchItemContent('quiz_body')).toEqual({ content: { body: ['A'] }, data: { best_score: 3 } })
  mocks.rpc.mockResolvedValueOnce({ data: [], error: null })
  expect(await fetchItemContent('quiz_body')).toBeNull()
  expect(mocks.rpc).toHaveBeenCalledWith('get_item_content', { p_item_id: 'quiz_body' })
})

test('zapis wyniku quizu i zakładanie wyglądu', async () => {
  mocks.rpc.mockResolvedValueOnce({ data: 4, error: null })
  expect(await saveQuizResult('quiz_body', 4)).toBe(4)
  expect(mocks.rpc).toHaveBeenLastCalledWith('save_quiz_result', { p_item_id: 'quiz_body', p_score: 4 })
  mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error('x') })
  expect(await saveQuizResult('quiz_body', 4)).toBeNull()
  mocks.rpc.mockResolvedValueOnce({ data: 'ok', error: null })
  expect(await setEquipped('pin_skin', null)).toBe('ok')
  expect(mocks.rpc).toHaveBeenLastCalledWith('set_equipped', { p_type: 'pin_skin', p_item_id: null })
  mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error('x') })
  expect(await setEquipped('title', 'title_odra')).toBe('error')
})
```

Utwórz `src/map/ratIcons.test.ts`:

```ts
import { expect, test } from 'vitest'
import { PIN_SKINS, RAT_ICON_SVG, ratIconSvg, skinOrDefault } from './ratIcons'

test('domyślna skórka wygląda jak dotychczasowa ikona', () => {
  expect(RAT_ICON_SVG).toBe(ratIconSvg('default', false))
  expect(RAT_ICON_SVG).toContain('fill="#C98A8F" stroke="#3A3839" stroke-width="2"')
  expect(RAT_ICON_SVG).toContain('<circle cx="48" cy="33" r="1.5" fill="#3A3839"/>')
})

test('skórka zmienia kolor futra, a własna pinezka ma okrąg', () => {
  expect(ratIconSvg('gold', false)).toContain(PIN_SKINS.gold.fill)
  expect(ratIconSvg('gold', true)).toContain('<circle cx="32" cy="38" r="27"')
  expect(ratIconSvg('gold', false)).not.toContain('<circle cx="32" cy="38" r="27"')
})

test('nieznana skórka wraca do domyślnej', () => {
  expect(skinOrDefault('gold')).toBe('gold')
  expect(skinOrDefault('toString')).toBe('default')
  expect(skinOrDefault(null)).toBe('default')
})
```

Utwórz `src/library/ItemView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ItemView } from './ItemView'
import { fetchItemContent, saveQuizResult, setEquipped, type CatalogItem } from './libraryApi'

vi.mock('./libraryApi', () => ({ fetchItemContent: vi.fn(), saveQuizResult: vi.fn(), setEquipped: vi.fn() }))

const base = { teaser: 't', price: 30, preview: null, owned: true, equipped: false }
const card: CatalogItem = { ...base, id: 'card_laugh', type: 'knowledge_card', name: 'Czy szczury się śmieją?' }
const quiz: CatalogItem = { ...base, id: 'quiz_body', type: 'quiz', name: 'Quiz: ciało i gatunki' }
const skin: CatalogItem = { ...base, id: 'pin_gold', type: 'pin_skin', name: 'Złoty szczur', preview: 'gold' }

test('karta wiedzy pokazuje akapity i źródła', async () => {
  vi.mocked(fetchItemContent).mockResolvedValue({
    content: { body: ['Akapit pierwszy.', 'Akapit drugi.'], sources: [{ label: 'Science', url: 'https://doi.org/x' }] },
    data: {},
  })
  const onBack = vi.fn()
  render(<ItemView item={card} onBack={onBack} onChanged={vi.fn()} />)
  expect(await screen.findByText('Akapit pierwszy.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Science' })).toHaveAttribute('href', 'https://doi.org/x')
  await userEvent.click(screen.getByRole('button', { name: '← Wróć do Biblioteki' }))
  expect(onBack).toHaveBeenCalled()
})

test('quiz: odpowiedzi, wyjaśnienia, wynik i zapis', async () => {
  vi.mocked(fetchItemContent).mockResolvedValue({
    content: {
      questions: [
        { question: 'Pierwsze?', answers: ['Tak', 'Nie', 'Może'], correct: 0, explain: 'Bo tak.' },
        { question: 'Drugie?', answers: ['Tak', 'Nie', 'Może'], correct: 1, explain: 'Bo nie.' },
      ],
    },
    data: { best_score: 1 },
  })
  vi.mocked(saveQuizResult).mockResolvedValue(2)
  render(<ItemView item={quiz} onBack={vi.fn()} onChanged={vi.fn()} />)

  expect(await screen.findByText('Pierwsze?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Tak' }))
  expect(screen.getByRole('status')).toHaveTextContent('Dobrze! Bo tak.')
  await userEvent.click(screen.getByRole('button', { name: 'Dalej' }))

  expect(screen.getByText('Drugie?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Nie' }))
  await userEvent.click(screen.getByRole('button', { name: 'Zobacz wynik' }))

  expect(await screen.findByText('Twój wynik: 2 z 2')).toBeInTheDocument()
  expect(await screen.findByText('Najlepszy wynik: 2 z 2')).toBeInTheDocument()
  expect(saveQuizResult).toHaveBeenCalledWith('quiz_body', 2)
  await userEvent.click(screen.getByRole('button', { name: 'Jeszcze raz' }))
  expect(screen.getByText('Pierwsze?')).toBeInTheDocument()
})

test('błędna odpowiedź w quizie pokazuje wyjaśnienie', async () => {
  vi.mocked(fetchItemContent).mockResolvedValue({
    content: { questions: [{ question: 'Q?', answers: ['A', 'B', 'C'], correct: 0, explain: 'Dobra to A.' }] },
    data: {},
  })
  render(<ItemView item={quiz} onBack={vi.fn()} onChanged={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name: 'C' }))
  expect(screen.getByRole('status')).toHaveTextContent('Niestety nie. Dobra to A.')
})

test('wygląd: zakładanie i zdejmowanie', async () => {
  vi.mocked(setEquipped).mockResolvedValue('ok')
  const onChanged = vi.fn()
  const { rerender } = render(<ItemView item={skin} onBack={vi.fn()} onChanged={onChanged} />)
  expect(screen.getByText('Tak zobaczą Twoje pinezki inne osoby na mapie.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Załóż' }))
  expect(setEquipped).toHaveBeenCalledWith('pin_skin', 'pin_gold')
  expect(onChanged).toHaveBeenCalled()

  rerender(<ItemView item={{ ...skin, equipped: true }} onBack={vi.fn()} onChanged={onChanged} />)
  expect(screen.getByText('Masz to na sobie.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Zdejmij' }))
  expect(setEquipped).toHaveBeenLastCalledWith('pin_skin', null)
})

test('błąd treści pokazuje komunikat', async () => {
  vi.mocked(fetchItemContent).mockResolvedValue(null)
  render(<ItemView item={card} onBack={vi.fn()} onChanged={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się wczytać treści.')
})
```

Run: `npx vitest run src/library src/map/ratIcons.test.ts`
Expected: FAIL — brak modułów.

- [ ] **Step 3: API i parsery**

Utwórz `src/library/libraryApi.ts`:

```ts
import { supabase } from '../lib/supabase'

export type ItemType = 'knowledge_card' | 'quiz' | 'pin_skin' | 'title'

export interface CatalogItem {
  id: string
  type: ItemType
  name: string
  teaser: string
  price: number
  preview: string | null
  owned: boolean
  equipped: boolean
}

export type PurchaseResult = 'purchased' | 'owned' | 'insufficient' | 'not_found' | 'error'
export type EquipResult = 'ok' | 'not_owned' | 'invalid' | 'error'

export interface ItemContent {
  content: unknown
  data: Record<string, unknown>
}

interface CatalogRow {
  id: string
  type: ItemType
  name: string
  teaser: string
  price: number
  preview: string | null
  owned: boolean
  equipped: boolean
}

const PURCHASE_RESULTS: readonly string[] = ['purchased', 'owned', 'insufficient', 'not_found']
const EQUIP_RESULTS: readonly string[] = ['ok', 'not_owned', 'invalid']

export async function fetchCatalog(): Promise<CatalogItem[]> {
  const { data, error } = await supabase.rpc('library_catalog')
  if (error) throw error
  return ((data ?? []) as CatalogRow[]).map((row) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    teaser: row.teaser,
    price: Number(row.price),
    preview: row.preview,
    owned: row.owned,
    equipped: row.equipped,
  }))
}

export async function purchaseItem(id: string): Promise<PurchaseResult> {
  const { data, error } = await supabase.rpc('purchase_item', { p_item_id: id })
  if (error || typeof data !== 'string' || !PURCHASE_RESULTS.includes(data)) return 'error'
  return data as PurchaseResult
}

export async function fetchItemContent(id: string): Promise<ItemContent | null> {
  const { data, error } = await supabase.rpc('get_item_content', { p_item_id: id })
  if (error) throw error
  const row = ((data ?? []) as { content: unknown; data: Record<string, unknown> | null }[])[0]
  return row ? { content: row.content, data: row.data ?? {} } : null
}

export async function saveQuizResult(id: string, score: number): Promise<number | null> {
  const { data, error } = await supabase.rpc('save_quiz_result', { p_item_id: id, p_score: score })
  if (error || typeof data !== 'number') return null
  return data
}

export async function setEquipped(type: 'pin_skin' | 'title', id: string | null): Promise<EquipResult> {
  const { data, error } = await supabase.rpc('set_equipped', { p_type: type, p_item_id: id })
  if (error || typeof data !== 'string' || !EQUIP_RESULTS.includes(data)) return 'error'
  return data as EquipResult
}
```

Utwórz `src/library/content.ts`:

```ts
export interface KnowledgeCard {
  body: string[]
  sources: { label: string; url: string }[]
}

export interface QuizQuestion {
  question: string
  answers: string[]
  correct: number
  explain: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export function parseCard(content: unknown): KnowledgeCard | null {
  if (!isRecord(content) || !isStringArray(content.body) || content.body.length === 0) return null
  const sources = Array.isArray(content.sources) ? content.sources : []
  return {
    body: content.body,
    // Tylko linki https — treść pochodzi z bazy, ale nie wstawiamy do href niczego innego.
    sources: sources.filter(
      (source): source is { label: string; url: string } =>
        isRecord(source) && typeof source.label === 'string' && typeof source.url === 'string' && source.url.startsWith('https://'),
    ),
  }
}

export function parseQuiz(content: unknown): QuizQuestion[] | null {
  if (!isRecord(content) || !Array.isArray(content.questions) || content.questions.length === 0) return null
  const questions: QuizQuestion[] = []
  for (const item of content.questions) {
    if (
      !isRecord(item) ||
      typeof item.question !== 'string' ||
      !isStringArray(item.answers) ||
      typeof item.correct !== 'number' ||
      !Number.isInteger(item.correct) ||
      item.correct < 0 ||
      item.correct >= item.answers.length
    ) {
      return null
    }
    questions.push({
      question: item.question,
      answers: item.answers,
      correct: item.correct,
      explain: typeof item.explain === 'string' ? item.explain : '',
    })
  }
  return questions
}

export function scoreQuiz(questions: QuizQuestion[], picks: number[]): number {
  return picks.filter((pick, index) => questions[index]?.correct === pick).length
}
```

Utwórz `src/library/useItemContent.ts`:

```ts
import { useEffect, useState } from 'react'
import { fetchItemContent, type ItemContent } from './libraryApi'

export type ContentState = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; item: ItemContent }

export function useItemContent(itemId: string): ContentState {
  const [state, setState] = useState<ContentState>({ kind: 'loading' })

  useEffect(() => {
    let active = true
    fetchItemContent(itemId).then(
      (item) => {
        if (active) setState(item ? { kind: 'loaded', item } : { kind: 'failed' })
      },
      () => {
        if (active) setState({ kind: 'failed' })
      },
    )
    return () => {
      active = false
    }
  }, [itemId])

  return state
}
```

W `src/map/ratIcons.ts` zastąp część z `RAT_PATHS`, `RAT_ICON_SVG` i `RAT_MINE_ICON_SVG` (funkcja `svgToImage` bez zmian):

```ts
export interface PinSkin {
  fill: string
  stroke: string
  eye: string
}

// Skórki pinezek z Biblioteki; przedmiot w bazie ma tylko klucz (np. {"skin":"gold"}).
export const PIN_SKINS: Record<string, PinSkin> = {
  default: { fill: '#C98A8F', stroke: '#3A3839', eye: '#3A3839' },
  gold: { fill: '#D9B44A', stroke: '#3A3839', eye: '#3A3839' },
  night: { fill: '#3A3839', stroke: '#EBD3D3', eye: '#EBD3D3' },
  sewer: { fill: '#7E9A83', stroke: '#3A3839', eye: '#3A3839' },
}

export function skinOrDefault(skin: string | null | undefined): string {
  return skin && Object.hasOwn(PIN_SKINS, skin) ? skin : 'default'
}

// Sylwetka szczura (patrz public/logo.svg) jako pinezka; własne zgłoszenia mają jasną obwódkę.
const RAT_PATHS = ({ fill, stroke, eye }: PinSkin) => `
  <path d="M13 38 C4 40 4 52 14 52" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/>
  <ellipse cx="28" cy="36" rx="16" ry="10" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
  <path d="M38 28 C46 26 54 30 58 36 C52 40 44 41 39 40 Z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
  <circle cx="40" cy="27" r="4" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
  <circle cx="48" cy="33" r="1.5" fill="${eye}"/>`

export function ratIconSvg(skin: string, mine: boolean): string {
  const paths = RAT_PATHS(PIN_SKINS[skinOrDefault(skin)])
  if (!mine) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${paths}</svg>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="38" r="27" fill="#FFFFFF" fill-opacity="0.85" stroke="#A5646B" stroke-width="3"/>
  ${paths}</svg>`
}

export const RAT_ICON_SVG = ratIconSvg('default', false)
export const RAT_MINE_ICON_SVG = ratIconSvg('default', true)
```

(Dotychczasowa ikona miała `stroke-width` 2 i oko `#3A3839` — wygląd domyślny się nie zmienia.)

- [ ] **Step 4: Widoki**

Utwórz `src/library/ItemView.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { CardView } from './CardView'
import { CosmeticView } from './CosmeticView'
import type { CatalogItem } from './libraryApi'
import { QuizView } from './QuizView'

export function ItemView({ item, onBack, onChanged }: { item: CatalogItem; onBack: () => void; onChanged: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="stack">
      <button className="btn--link library__back" type="button" onClick={onBack}>
        {t('library.back')}
      </button>
      <h1>{item.name}</h1>
      {item.type === 'knowledge_card' && <CardView itemId={item.id} />}
      {item.type === 'quiz' && <QuizView itemId={item.id} />}
      {(item.type === 'pin_skin' || item.type === 'title') && <CosmeticView item={item} onChanged={onChanged} />}
    </div>
  )
}
```

Utwórz `src/library/CardView.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { parseCard } from './content'
import { useItemContent } from './useItemContent'

export function CardView({ itemId }: { itemId: string }) {
  const { t } = useTranslation()
  const state = useItemContent(itemId)

  if (state.kind === 'loading') return <p className="muted">{t('app.loading')}</p>
  const card = state.kind === 'loaded' ? parseCard(state.item.content) : null
  if (!card) {
    return (
      <p className="error" role="alert">
        {t('library.contentFailed')}
      </p>
    )
  }

  return (
    <article className="stack library__card">
      {card.body.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
      {card.sources.length > 0 && (
        <>
          <h2>{t('library.sources')}</h2>
          <ul className="library__sources">
            {card.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  )
}
```

Utwórz `src/library/QuizView.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { parseQuiz, scoreQuiz } from './content'
import { saveQuizResult } from './libraryApi'
import { useItemContent } from './useItemContent'

export function QuizView({ itemId }: { itemId: string }) {
  const { t } = useTranslation()
  const state = useItemContent(itemId)
  const [picks, setPicks] = useState<number[]>([])
  const [picked, setPicked] = useState<number | null>(null)
  const [best, setBest] = useState<number | null>(null)

  if (state.kind === 'loading') return <p className="muted">{t('app.loading')}</p>
  const questions = state.kind === 'loaded' ? parseQuiz(state.item.content) : null
  if (!questions) {
    return (
      <p className="error" role="alert">
        {t('library.contentFailed')}
      </p>
    )
  }

  const stored = state.kind === 'loaded' ? state.item.data.best_score : undefined
  const bestScore = best ?? (typeof stored === 'number' ? stored : null)
  const total = questions.length

  async function advance() {
    if (picked === null || !questions) return
    const nextPicks = [...picks, picked]
    setPicks(nextPicks)
    setPicked(null)
    if (nextPicks.length === total) {
      const saved = await saveQuizResult(itemId, scoreQuiz(questions, nextPicks))
      if (saved !== null) setBest(saved)
    }
  }

  if (picks.length === total) {
    return (
      <div className="stack">
        <p className="library__score">{t('library.quiz.score', { score: scoreQuiz(questions, picks), total })}</p>
        {bestScore !== null && <p className="muted">{t('library.quiz.best', { best: bestScore, total })}</p>}
        <button
          className="btn"
          type="button"
          onClick={() => {
            setPicks([])
            setPicked(null)
          }}
        >
          {t('library.quiz.again')}
        </button>
      </div>
    )
  }

  const index = picks.length
  const question = questions[index]

  return (
    <div className="stack">
      <span className="muted">{t('library.quiz.progress', { n: index + 1, total })}</span>
      <p className="library__question">{question.question}</p>
      <div className="stack">
        {question.answers.map((answer, answerIndex) => {
          let className = 'btn btn--ghost'
          if (picked !== null && answerIndex === question.correct) className = 'btn library__answer--correct'
          else if (picked !== null && answerIndex === picked) className = 'btn btn--ghost library__answer--wrong'
          return (
            <button
              key={answerIndex}
              className={className}
              type="button"
              disabled={picked !== null}
              onClick={() => setPicked(answerIndex)}
            >
              {answer}
            </button>
          )
        })}
      </div>
      {picked !== null && (
        <>
          <p role="status">
            {picked === question.correct ? t('library.quiz.correct') : t('library.quiz.wrong')} {question.explain}
          </p>
          <button className="btn" type="button" onClick={() => void advance()}>
            {index + 1 === total ? t('library.quiz.finish') : t('library.quiz.next')}
          </button>
        </>
      )}
    </div>
  )
}
```

Utwórz `src/library/CosmeticView.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ratIconSvg, skinOrDefault } from '../map/ratIcons'
import { setEquipped, type CatalogItem } from './libraryApi'

export function CosmeticView({ item, onChanged }: { item: CatalogItem; onChanged: () => void }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const type = item.type === 'pin_skin' ? 'pin_skin' : 'title'

  async function toggle() {
    setBusy(true)
    setFailed(false)
    const result = await setEquipped(type, item.equipped ? null : item.id)
    setBusy(false)
    if (result === 'ok') onChanged()
    else setFailed(true)
  }

  return (
    <div className="stack">
      {type === 'pin_skin' ? (
        <img
          className="library__skin"
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(ratIconSvg(skinOrDefault(item.preview), false))}`}
          alt=""
          width={96}
          height={96}
        />
      ) : (
        <p className="library__title-preview">{t('library.cosmetic.titlePreview', { title: item.preview ?? item.name })}</p>
      )}
      <p className="muted">{t(type === 'pin_skin' ? 'library.cosmetic.skinHint' : 'library.cosmetic.titleHint')}</p>
      {item.equipped && <p>{t('library.cosmetic.equippedNow')}</p>}
      {failed && (
        <p className="error" role="alert">
          {t('library.cosmetic.equipFailed')}
        </p>
      )}
      <button className={item.equipped ? 'btn btn--ghost' : 'btn'} type="button" disabled={busy} onClick={() => void toggle()}>
        {t(item.equipped ? 'library.cosmetic.unequip' : 'library.cosmetic.equip')}
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Uruchom testy, typy i lint**

Run: `npm test && npx tsc -b && npm run lint`
Expected: wszystko przechodzi, 0 ostrzeżeń.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat: library item views for knowledge cards, quizzes and cosmetics"
```

---

### Task 5: Ekran Biblioteki, zakupy i zakładka

**Files:**
- Create: `src/library/LibraryScreen.tsx`, `src/library/LibraryScreen.test.tsx`, `src/library/library.css`
- Modify: `src/shell/TabBar.tsx`, `src/shell/TabBar.test.tsx`, `src/shell/AppShell.tsx`, `src/shell/shell.css`, `src/main.tsx`, `src/App.test.tsx`, `src/i18n/pl.json`

**Interfaces:**
- Consumes: `fetchCatalog`, `purchaseItem`, `CatalogItem`, `ItemType`, `PurchaseResult`, `ItemView` (Task 4); `profile.tokens_balance`, `onProfileChange` (AppShell)
- Produces: `LibraryScreen({ balance, onBalanceChange }: { balance: number; onBalanceChange: () => void })`; `Tab` = `'map' | 'report' | 'ranking' | 'library' | 'profile'`

- [ ] **Step 1: Teksty**

W `src/i18n/pl.json` w sekcji `tabs` dodaj `"library": "Biblioteka"` (między `ranking` a `profile`).

- [ ] **Step 2: Napisz testy**

Utwórz `src/library/LibraryScreen.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { LibraryScreen } from './LibraryScreen'
import { fetchCatalog, purchaseItem, type CatalogItem } from './libraryApi'

vi.mock('./libraryApi', () => ({ fetchCatalog: vi.fn(), purchaseItem: vi.fn() }))
vi.mock('./ItemView', () => ({
  ItemView: ({ item, onBack }: { item: CatalogItem; onBack: () => void }) => (
    <div>
      <p>Otwarte: {item.name}</p>
      <button type="button" onClick={onBack}>
        wróć
      </button>
    </div>
  ),
}))

const card: CatalogItem = { id: 'card_laugh', type: 'knowledge_card', name: 'Czy szczury się śmieją?', teaser: 'Łaskotanie', price: 30, preview: null, owned: false, equipped: false }
const quiz: CatalogItem = { id: 'quiz_body', type: 'quiz', name: 'Quiz: ciało i gatunki', teaser: '5 pytań', price: 50, preview: null, owned: true, equipped: false }
const skin: CatalogItem = { id: 'pin_gold', type: 'pin_skin', name: 'Złoty szczur', teaser: 'Lśni', price: 300, preview: 'gold', owned: true, equipped: true }

test('pokazuje saldo i sekcje z cenami lub oznaczeniem posiadania', async () => {
  vi.mocked(fetchCatalog).mockResolvedValue([card, quiz, skin])
  render(<LibraryScreen balance={40} onBalanceChange={vi.fn()} />)

  expect(screen.getByText('Masz 40 racików')).toBeInTheDocument()
  const cards = await screen.findByRole('region', { name: 'Karty wiedzy' })
  expect(within(cards).getByRole('button', { name: /Czy szczury się śmieją\?.*30 racików/ })).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Quizy' })).getByText('Masz ✓')).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Wygląd' })).getByText('Założone')).toBeInTheDocument()
})

test('kupuje przedmiot po potwierdzeniu i otwiera go', async () => {
  vi.mocked(fetchCatalog).mockResolvedValueOnce([card]).mockResolvedValue([{ ...card, owned: true }])
  vi.mocked(purchaseItem).mockResolvedValue('purchased')
  const onBalanceChange = vi.fn()
  render(<LibraryScreen balance={40} onBalanceChange={onBalanceChange} />)

  await userEvent.click(await screen.findByRole('button', { name: /Czy szczury się śmieją/ }))
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveTextContent('Kupić „Czy szczury się śmieją?” za 30 racików?')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Kup' }))

  expect(purchaseItem).toHaveBeenCalledWith('card_laugh')
  expect(onBalanceChange).toHaveBeenCalled()
  expect(await screen.findByText('Otwarte: Czy szczury się śmieją?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'wróć' }))
  expect(screen.getByRole('region', { name: 'Karty wiedzy' })).toBeInTheDocument()
})

test('za mało racików blokuje zakup', async () => {
  vi.mocked(fetchCatalog).mockResolvedValue([card])
  render(<LibraryScreen balance={10} onBalanceChange={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name: /Czy szczury się śmieją/ }))
  expect(screen.getByText(/Brakuje Ci 20 racików/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Kup' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Anuluj' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('posiadany przedmiot otwiera się od razu', async () => {
  vi.mocked(fetchCatalog).mockResolvedValue([quiz])
  render(<LibraryScreen balance={0} onBalanceChange={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name: /Quiz: ciało i gatunki/ }))
  expect(screen.getByText('Otwarte: Quiz: ciało i gatunki')).toBeInTheDocument()
})

test('nieudany zakup i błąd katalogu pokazują komunikat', async () => {
  vi.mocked(fetchCatalog).mockResolvedValueOnce([card])
  vi.mocked(purchaseItem).mockResolvedValue('error')
  const { unmount } = render(<LibraryScreen balance={40} onBalanceChange={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name: /Czy szczury się śmieją/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Kup' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się kupić. Spróbuj ponownie.')
  unmount()

  vi.mocked(fetchCatalog).mockRejectedValue(new Error('offline'))
  render(<LibraryScreen balance={40} onBalanceChange={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się wczytać Biblioteki.')
})
```

W `src/shell/TabBar.test.tsx` dopisz:

```tsx
test('ma zakładkę Biblioteka', async () => {
  const onSelect = vi.fn()
  render(<TabBar active="map" onSelect={onSelect} />)
  await userEvent.click(screen.getByRole('button', { name: 'Biblioteka' }))
  expect(onSelect).toHaveBeenCalledWith('library')
})
```

W `src/App.test.tsx` dodaj mock:

```tsx
vi.mock('./library/libraryApi', () => ({ fetchCatalog: vi.fn(async () => []), purchaseItem: vi.fn() }))
```

Run: `npx vitest run src/library/LibraryScreen.test.tsx src/shell`
Expected: FAIL — brak `LibraryScreen` i zakładki.

- [ ] **Step 3: Implementacja**

Utwórz `src/library/LibraryScreen.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ItemView } from './ItemView'
import { fetchCatalog, purchaseItem, type CatalogItem, type ItemType, type PurchaseResult } from './libraryApi'

type State = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; items: CatalogItem[] }

const SECTIONS: { key: 'cards' | 'quizzes' | 'looks'; types: ItemType[] }[] = [
  { key: 'cards', types: ['knowledge_card'] },
  { key: 'quizzes', types: ['quiz'] },
  { key: 'looks', types: ['pin_skin', 'title'] },
]

export function LibraryScreen({ balance, onBalanceChange }: { balance: number; onBalanceChange: () => void }) {
  const { t } = useTranslation()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [version, setVersion] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [buying, setBuying] = useState<CatalogItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PurchaseResult | null>(null)

  useEffect(() => {
    let active = true
    fetchCatalog().then(
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
  }, [version])

  function reload() {
    setVersion((current) => current + 1)
  }

  async function buy(item: CatalogItem) {
    setBusy(true)
    const outcome = await purchaseItem(item.id)
    setBusy(false)
    setBuying(null)
    if (outcome === 'purchased' || outcome === 'owned') {
      onBalanceChange()
      reload()
      setOpenId(item.id)
      return
    }
    setResult(outcome)
  }

  const items = state.kind === 'loaded' ? state.items : []
  const opened = items.find((item) => item.id === openId && item.owned)

  if (opened) {
    return (
      <section className="screen">
        <ItemView item={opened} onBack={() => setOpenId(null)} onChanged={reload} />
      </section>
    )
  }

  return (
    <section className="screen stack library">
      <h1>{t('library.title')}</h1>
      <p className="library__balance">{t('library.balance', { raciki: t('result.raciki', { count: balance }) })}</p>
      {result && (
        <p className="error" role="alert">
          {t(`library.purchaseResult.${result}`)}
        </p>
      )}
      {state.kind === 'loading' && <p className="muted">{t('app.loading')}</p>}
      {state.kind === 'failed' && (
        <p className="error" role="alert">
          {t('library.loadFailed')}
        </p>
      )}
      {state.kind === 'loaded' &&
        SECTIONS.map((section) => (
          <section key={section.key} className="stack" aria-labelledby={`library-${section.key}`}>
            <h2 id={`library-${section.key}`}>{t(`library.sections.${section.key}`)}</h2>
            <ul className="library__list">
              {items
                .filter((item) => section.types.includes(item.type))
                .map((item) => (
                  <li key={item.id}>
                    <button
                      className="card library__item"
                      type="button"
                      onClick={() => {
                        setResult(null)
                        if (item.owned) setOpenId(item.id)
                        else setBuying(item)
                      }}
                    >
                      <span className="stack library__text">
                        <strong>{item.name}</strong>
                        <span className="muted">{item.teaser}</span>
                      </span>
                      <span className="library__price">
                        {item.equipped
                          ? t('library.equipped')
                          : item.owned
                            ? t('library.owned')
                            : t('result.raciki', { count: item.price })}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        ))}

      {buying && (
        <div className="modal-backdrop">
          <div className="modal card stack" role="dialog" aria-modal="true" aria-label={buying.name}>
            <p>{t('library.buyConfirm', { name: buying.name, raciki: t('result.raciki', { count: buying.price }) })}</p>
            {balance < buying.price && (
              <p className="error">{t('library.missing', { raciki: t('result.raciki', { count: buying.price - balance }) })}</p>
            )}
            <button
              className="btn"
              type="button"
              disabled={busy || balance < buying.price}
              onClick={() => void buy(buying)}
            >
              {t('library.buy')}
            </button>
            <button className="btn btn--ghost" type="button" onClick={() => setBuying(null)}>
              {t('library.cancel')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
```

(Uwaga do testu „kupuje przedmiot”: po zakupie katalog przeładowuje się z `owned: true`, więc `ItemView` otwiera się dopiero po odświeżeniu — dlatego test czeka przez `findByText`.)

Utwórz `src/library/library.css`:

```css
.library__balance {
  margin: 0;
  font-weight: 800;
  color: var(--rose-dark);
}

.library__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.library__item {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.library__text {
  gap: 2px;
}

.library__price {
  flex-shrink: 0;
  font-weight: 800;
  color: var(--rose-dark);
}

.library__back {
  align-self: flex-start;
}

.library__card p {
  margin: 0;
  line-height: 1.5;
}

.library__sources {
  margin: 0;
  padding-left: 20px;
}

.library__question {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.library__answer--correct {
  outline: 3px solid var(--rose-dark);
}

.library__answer--wrong {
  text-decoration: line-through;
}

.library__score {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
}

.library__skin {
  align-self: center;
}

.library__title-preview {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  text-align: center;
  color: var(--rose-dark);
}
```

W `src/main.tsx` dodaj `import './library/library.css'` po `import './ranking/ranking.css'`.

W `src/shell/TabBar.tsx`: typ `Tab` = `'map' | 'report' | 'ranking' | 'library' | 'profile'`; w `TABS` przed `profile` dodaj `{ id: 'library', icon: '📚' }`.

W `src/shell/shell.css` w `.tabbar` zmień `grid-template-columns: repeat(4, 1fr);` na `repeat(5, 1fr)`.

W `src/shell/AppShell.tsx` dodaj import `import { LibraryScreen } from '../library/LibraryScreen'` i gałąź przed rankingiem:

```tsx
        ) : tab === 'library' ? (
          <LibraryScreen balance={profile.tokens_balance} onBalanceChange={onProfileChange} />
```

- [ ] **Step 4: Uruchom testy, typy, lint i build**

Run: `npm test && npx tsc -b && npm run lint && npm run build`
Expected: wszystko przechodzi, 0 ostrzeżeń.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: library tab with catalog and purchases"
```

---

### Task 6: Skórki na mapie, tytuły w rankingu i panelu pinezki

**Files:**
- Modify: `src/map/pins.ts`, `src/map/pins.test.ts`, `src/map/mapApi.ts`, `src/map/mapApi.test.ts`, `src/map/MapView.tsx`, `src/map/PinPanel.tsx`, `src/map/MapScreen.test.tsx`, `src/map/map.css`, `src/ranking/rankingApi.ts`, `src/ranking/rankingApi.test.ts`, `src/ranking/RankingScreen.tsx`, `src/ranking/RankingScreen.test.tsx`, `src/ranking/ranking.css`, `src/i18n/pl.json`

**Interfaces:**
- Consumes: kolumny `skin`, `title` z `sightings_in_view` i `title` z `get_ranking` (Task 3); `PIN_SKINS`, `skinOrDefault`, `ratIconSvg` (Task 4)
- Produces: `Pin` ma dodatkowo `skin: string | null; title: string | null`; `PinProperties` ma `skin: string` (zawsze znany klucz); `RankingRow` ma `title: string | null`

- [ ] **Step 1: Tekst**

W `src/i18n/pl.json` w sekcji `map` dodaj `"title": "„{{title}}”"`.

- [ ] **Step 2: Napisz/zmień testy**

- `src/map/mapApi.test.ts`: w teście `fetchPins` dodaj do wiersza z bazy `skin: 'gold', title: 'Tester'`, a do oczekiwanej pinezki `skin: 'gold', title: 'Tester'`.
- `src/map/pins.test.ts`: w teście `toFeatureCollection` dodaj pinezkom `skin`/`title` (jedna `skin: 'gold'`, druga `skin: null`) i oczekuj w `properties` odpowiednio `skin: 'gold'` i `skin: 'default'`; jeśli testu `toFeatureCollection` nie ma, dopisz:

```ts
test('właściwości pinezki mają znaną skórkę', () => {
  const base = { lon: 17, lat: 51, rats: 1, createdAt: '2026-10-05T10:00:00Z', photoPath: 'a.jpg', nickname: null, isMine: false, title: null }
  const collection = toFeatureCollection(
    [
      { ...base, id: 'a', skin: 'gold' },
      { ...base, id: 'b', skin: 'nieznana' },
    ],
    Date.parse('2026-10-05T10:00:00Z'),
    7,
  )
  expect(collection.features.map((feature) => feature.properties.skin)).toEqual(['gold', 'default'])
})
```

- `src/map/MapScreen.test.tsx` (i każdy inny test budujący obiekt `Pin`): dodaj do obiektu pinezki `skin: null, title: 'Kanałowy Detektyw'`; w teście, który sprawdza panel (`expect(panel).toHaveTextContent('Wypatrzył(a): Ala')`), dopisz `expect(panel).toHaveTextContent('„Kanałowy Detektyw”')`.
- `src/ranking/rankingApi.test.ts`: dodaj `title: 'Tester'` do wiersza z bazy i do oczekiwanego wyniku.
- `src/ranking/RankingScreen.test.tsx`: w pierwszym teście dodaj pierwszemu wierszowi `title: 'Kanałowy Detektyw'`, pozostałym `title: null`, i oczekuj `within(items[0]).getByText('Kanałowy Detektyw')`. W pozostałych testach dodaj `title: null` do wierszy.

Run: `npx vitest run src/map src/ranking`
Expected: FAIL (brak pól `skin`/`title`).

- [ ] **Step 3: Implementacja**

`src/map/pins.ts`:
- do `Pin` dodaj `skin: string | null` i `title: string | null`
- do `PinProperties` dodaj `skin: string`
- w `toFeatureCollection` w `properties` dodaj `skin: skinOrDefault(pin.skin)` (import `import { skinOrDefault } from './ratIcons'`)

`src/map/mapApi.ts`: do `PinRow` dodaj `skin: string | null; title: string | null`, a w mapowaniu `skin: row.skin, title: row.title`.

`src/map/MapView.tsx`:
- import zamień na `import { PIN_SKINS, ratIconSvg, svgToImage } from './ratIcons'`
- wczytywanie ikon (w `map.on('load', …)`) zastąp:

```tsx
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
```

(reszta bloku `catch` bez zmian)
- w warstwie `rats` zamień `'icon-image': ['case', ['get', 'mine'], 'rat-mine', 'rat'],` na:

```tsx
            'icon-image': ['concat', 'rat-', ['get', 'skin'], ['case', ['get', 'mine'], '-mine', '']],
```

`src/map/PinPanel.tsx`: bezpośrednio po linii z autorem (`<span className="muted">{pin.nickname ? … }</span>`) dodaj:

```tsx
      {pin.title && <span className="pin-panel__title">{t('map.title', { title: pin.title })}</span>}
```

Dopisz do `src/map/map.css`:

```css
.pin-panel__title {
  font-weight: 800;
  color: var(--rose-dark);
}
```

`src/ranking/rankingApi.ts`: do `RankingRow` i `Row` dodaj `title: string | null`; w mapowaniu `title: row.title ?? null`.

`src/ranking/RankingScreen.tsx`: w `<strong className="ranking__name">` po pseudonimie i oznaczeniu „(Ty)” dodaj:

```tsx
                    {row.title && <span className="ranking__title">{row.title}</span>}
```

Dopisz do `src/ranking/ranking.css`:

```css
.ranking__title {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: var(--rose-dark);
}
```

- [ ] **Step 4: Uruchom testy, typy, lint i build**

Run: `npm test && npx tsc -b && npm run lint && npm run build`
Expected: wszystko przechodzi, 0 ostrzeżeń.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: show pin skins on the map and titles in ranking and pin panel"
```

---

### Task 7: E2E Biblioteki i dokumentacja

**Files:**
- Create: `tests/e2e/library.spec.ts`
- Modify: `tests/e2e/helpers.ts`, `docs/admin.md`, `README.md`

**Interfaces:**
- Consumes: cała aplikacja; lokalny Supabase (`npm run db:start`), klucz `SECRET_KEY` z `npx supabase status -o env`
- Produces: helper `grantRaciki(email: string, amount: number): Promise<void>`

- [ ] **Step 1: Helper nadający raciki**

Dopisz do `tests/e2e/helpers.ts`:

```ts
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

function localSecretKey(): string {
  const status = execSync('npx supabase status -o env', { stdio: ['ignore', 'pipe', 'ignore'] }).toString()
  const line = status.split('\n').find((entry) => entry.startsWith('SECRET_KEY='))
  if (!line) throw new Error('Brak SECRET_KEY — czy działa npm run db:start?')
  return line.slice('SECRET_KEY='.length).replace(/^"|"$/g, '')
}

// Testowe raciki: korekta w dzienniku i saldo profilu (tylko lokalna baza).
export async function grantRaciki(email: string, amount: number): Promise<void> {
  const admin = createClient('http://127.0.0.1:54321', localSecretKey())
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  const user = data.users.find((candidate) => candidate.email === email)
  if (!user) throw new Error(`Brak konta ${email}`)
  const ledger = await admin.from('token_ledger').insert({ user_id: user.id, delta: amount, reason: 'correction' })
  if (ledger.error) throw ledger.error
  const profile = await admin.from('profiles').update({ tokens_balance: amount }).eq('id', user.id)
  if (profile.error) throw profile.error
}
```

(Importy dopisz na górze pliku, obok istniejących.)

- [ ] **Step 2: Scenariusz**

Utwórz `tests/e2e/library.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { completeOnboarding, dismissInstallHint, grantRaciki, signIn, uniqueEmail, uniqueNickname } from './helpers'

test('zakup karty wiedzy za raciki i jej przeczytanie', async ({ page }) => {
  const email = uniqueEmail()
  await signIn(page, email)
  // Raciki przed onboardingiem — profil wczytuje się na nowo po jego zakończeniu.
  await grantRaciki(email, 100)
  await completeOnboarding(page, uniqueNickname())
  await dismissInstallHint(page)

  await page.getByRole('button', { name: 'Biblioteka', exact: true }).click()
  await expect(page.getByText('Masz 100 racików')).toBeVisible()

  await page.getByRole('button', { name: /Czy szczury się śmieją\?/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Kup', exact: true }).click()
  await expect(page.getByText(/Jaak Panksepp/)).toBeVisible()

  await page.getByRole('button', { name: '← Wróć do Biblioteki' }).click()
  await expect(page.getByText('Masz 70 racików')).toBeVisible()
  await expect(page.getByRole('button', { name: /Czy szczury się śmieją\?.*Masz ✓/ })).toBeVisible()
})
```

- [ ] **Step 3: Uruchom E2E**

W osobnym terminalu: `npm run db:start` (jeśli nie działa) i `npm run functions:serve` (zostaw). Następnie:

Run: `npm run e2e`
Expected: `4 passed`. Zatrzymaj `functions:serve` po PID.

- [ ] **Step 4: Dokumentacja**

Dopisz do `docs/admin.md` sekcję:

````markdown
## Szczurza Biblioteka

Przedmioty są w tabeli `reward_items` (SQL Editor w panelu Supabase). Treść karty: `{"body": ["akapit", …], "sources": [{"label": "…", "url": "https://…"}]}`; quizu: `{"questions": [{"question": "…", "answers": ["…", "…", "…"], "correct": 0, "explain": "…"}]}` (`correct` liczone od 0); skórki: `{"skin": "gold" | "night" | "sewer"}` (nowe kolory wymagają zmiany `PIN_SKINS` w `src/map/ratIcons.ts`); tytułu: `{"label": "…"}`.

Dodanie karty:

```sql
insert into public.reward_items (id, type, name, teaser, price, sort_order, content)
values ('card_nowa', 'knowledge_card', 'Tytuł karty', 'Zajawka', 30, 14,
        $j${"body": ["Akapit 1.", "Akapit 2."], "sources": [{"label": "Źródło", "url": "https://…"}]}$j$::jsonb);
```

Wycofanie przedmiotu ze sprzedaży (kupione zostają u osób, które je mają): `update public.reward_items set active = false where id = '…';`
````

W `README.md` w opisie funkcji (jeśli jest lista) dopisz „Szczurza Biblioteka: karty wiedzy, quizy i wygląd za raciki”.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e docs/admin.md README.md
git commit -m "test: end-to-end library purchase; docs for managing library items"
```

---

### Task 8: Wdrożenie (kontroler, po przeglądzie i zgodzie właściciela)

- [ ] **Step 1:** `npx supabase db push --dry-run` (oczekiwane 3 migracje `20261005…`), potem `npx supabase db push`.
- [ ] **Step 2:** `npm run deploy` (funkcje Edge bez zmian).
- [ ] **Step 3:** Sprawdzenie: `POST …/rest/v1/rpc/library_catalog` z kluczem publicznym bez logowania → odmowa (401/42501); aplikacja 200.
- [ ] **Step 4:** Właściciel: zakładka „Biblioteka”, zakup karty, quiz, założenie skórki (pinezka na mapie zmienia kolor).
