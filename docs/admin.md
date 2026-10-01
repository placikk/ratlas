# Ratlas — instrukcja administratora

Panel: https://supabase.com/dashboard/project/vbarjfzxlfsayqwewdrt

## Pinezki ukryte po zgłoszeniach

Po 3 zgłoszeniach nadużycia od różnych osób pinezka znika z mapy (`sightings.hidden = true`).

1. **Table Editor → `sightings`** → filtr `hidden` = `true`.
2. Obejrzyj zdjęcie: **Storage → `map-photos`** → plik `<id zgłoszenia>.jpg`.
3. Powody zgłoszeń: **Table Editor → `reports`** → filtr `sighting_id` = id zgłoszenia.
4. Decyzja:
   - **Zgłoszenie w porządku** → ustaw `hidden` = `false` (pinezka wraca na mapę) i usuń jego wiersze z `reports`.
   - **Nadużycie** → zostaw ukryte. Jeśli chcesz cofnąć punkty, w **SQL Editor** uruchom (podmień id):

```sql
begin;
update public.profiles p
   set total_rats = greatest(0, p.total_rats - s.rats_awarded),
       tokens_balance = greatest(0, p.tokens_balance - s.tokens_awarded)
  from public.sightings s
 where s.id = '<id zgłoszenia>' and p.id = s.user_id;
insert into public.token_ledger (user_id, delta, reason, ref_id)
select user_id, -tokens_awarded, 'correction', id from public.sightings where id = '<id zgłoszenia>';
commit;
```

## Werdykt modelu dla zgłoszenia

**Table Editor → `sightings`** → kolumny `status`, `reject_reason`, `verifier`, `verifier_raw` (pełna odpowiedź Gemini). Zdjęcia prywatne (selfie, odrzucone, oczekujące): **Storage → `sightings-private`** → folder z id użytkownika.
