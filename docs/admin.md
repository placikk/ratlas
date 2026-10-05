# Ratlas — instrukcja administratora

Panel: https://supabase.com/dashboard/project/vbarjfzxlfsayqwewdrt

## Pinezki ukryte po zgłoszeniach

Po 3 zgłoszeniach nadużycia od różnych osób pinezka znika z mapy (`sightings.hidden = true`).

1. **Table Editor → `sightings`** → filtr `hidden` = `true`.
2. Obejrzyj zdjęcie: **Storage → `map-photos`** → plik `<id zgłoszenia>.jpg`.
3. Powody zgłoszeń: **Table Editor → `reports`** → filtr `sighting_id` = id zgłoszenia.
4. Decyzja:
   - **Zgłoszenie w porządku** → ustaw `hidden` = `false` (pinezka wraca na mapę) i usuń jego wiersze z `reports`.
   - **Nadużycie** → zostaw ukryte. Jeśli zdjęcie jest nieodpowiednie, usuń też plik w **Storage → `map-photos`**. Jeśli chcesz cofnąć punkty, w **SQL Editor** uruchom (podmień id):

```sql
begin;
with old as (
  select s.id, s.user_id, s.rats_awarded, s.tokens_awarded,
         least(s.tokens_awarded, (select p.tokens_balance from public.profiles p where p.id = s.user_id)) as deducted
    from public.sightings s
   where s.id = '<id zgłoszenia>' and (s.rats_awarded > 0 or s.tokens_awarded > 0)
     for update
),
zeroed as (
  update public.sightings s
     set rats_awarded = 0, tokens_awarded = 0
    from old
   where s.id = old.id
  returning old.id, old.user_id, old.rats_awarded, old.deducted
),
reduced as (
  update public.profiles p
     set total_rats = greatest(0, p.total_rats - z.rats_awarded),
         tokens_balance = p.tokens_balance - z.deducted
    from zeroed z
   where p.id = z.user_id
  returning p.id
)
insert into public.token_ledger (user_id, delta, reason, ref_id)
select user_id, -deducted, 'correction', id from zeroed where deducted > 0;
commit;
```

   Zapytanie jest bezpieczne do ponownego uruchomienia: zeruje punkty zgłoszenia i koryguje profil tylko raz. Raciki mogły już zostać wydane w Bibliotece, więc odejmujemy najwyżej tyle, ile osoba ma teraz na saldzie, a w rejestrze zapisuje się faktycznie odjęta kwota.

## Werdykt modelu dla zgłoszenia

**Table Editor → `sightings`** → kolumny `status`, `reject_reason`, `verifier`, `verifier_raw` (pełna odpowiedź Gemini). Zdjęcia prywatne (selfie, odrzucone, oczekujące): **Storage → `sightings-private`** → folder z id użytkownika.

## Szczurza Biblioteka

Przedmioty są w tabeli `reward_items` (SQL Editor w panelu Supabase). Treść karty: `{"body": ["akapit", …], "sources": [{"label": "…", "url": "https://…"}]}`; quizu: `{"questions": [{"question": "…", "answers": ["…", "…", "…"], "correct": 0, "explain": "…"}]}` (`correct` liczone od 0); skórki: `{"skin": "gold" | "night" | "sewer"}` (nowe kolory wymagają zmiany `PIN_SKINS` w `src/map/ratIcons.ts`); tytułu: `{"label": "…"}`.

Dodanie karty:

```sql
insert into public.reward_items (id, type, name, teaser, price, sort_order, content)
values ('card_nowa', 'knowledge_card', 'Tytuł karty', 'Zajawka', 30, 14,
        $j${"body": ["Akapit 1.", "Akapit 2."], "sources": [{"label": "Źródło", "url": "https://…"}]}$j$::jsonb);
```

Wycofanie przedmiotu ze sprzedaży (kupione zostają u osób, które je mają): `update public.reward_items set active = false where id = '…';`
