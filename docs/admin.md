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
  select id, user_id, rats_awarded, tokens_awarded
    from public.sightings
   where id = '<id zgłoszenia>' and (rats_awarded > 0 or tokens_awarded > 0)
     for update
),
zeroed as (
  update public.sightings s
     set rats_awarded = 0, tokens_awarded = 0
    from old
   where s.id = old.id
  returning old.id, old.user_id, old.rats_awarded, old.tokens_awarded
),
reduced as (
  update public.profiles p
     set total_rats = greatest(0, p.total_rats - z.rats_awarded),
         tokens_balance = greatest(0, p.tokens_balance - z.tokens_awarded)
    from zeroed z
   where p.id = z.user_id
  returning p.id
)
insert into public.token_ledger (user_id, delta, reason, ref_id)
select user_id, -tokens_awarded, 'correction', id from zeroed where tokens_awarded > 0;
commit;
```

   Zapytanie jest bezpieczne do ponownego uruchomienia: zeruje punkty zgłoszenia i koryguje profil tylko raz.

## Werdykt modelu dla zgłoszenia

**Table Editor → `sightings`** → kolumny `status`, `reject_reason`, `verifier`, `verifier_raw` (pełna odpowiedź Gemini). Zdjęcia prywatne (selfie, odrzucone, oczekujące): **Storage → `sightings-private`** → folder z id użytkownika.
