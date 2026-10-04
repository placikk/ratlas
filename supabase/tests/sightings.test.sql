begin;
select plan(39);
delete from public.achievements;

insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'ala@example.com'),
       ('22222222-2222-2222-2222-222222222222', 'ola@example.com'),
       ('33333333-3333-3333-3333-333333333333', 'ula@example.com');

-- Rynek i plac Grunwaldzki (~1,7 km od siebie), Warszawa.
create temporary table v (name text primary key, value jsonb);
insert into v values
  ('three', '{"ratCount":3,"isSelfie":false,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":["smietnik"],"raw":{"m":1}}'),
  ('nine', '{"ratCount":9,"isSelfie":false,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":[],"raw":{}}'),
  ('none', '{"ratCount":0,"isSelfie":false,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":[],"raw":{}}'),
  ('screen', '{"ratCount":1,"isSelfie":false,"isScreenOrPrint":true,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":[],"raw":{}}'),
  ('faces', '{"ratCount":2,"isSelfie":false,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":true,"tags":[],"raw":{}}'),
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

-- zdjęcie z twarzą osoby trzeciej: zaliczone, ale nie publiczne
select is(
  (select row(r ->> 'status', r ->> 'public_on_map')::text
     from (select public.record_sighting('bbbbbbbb-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 17.0700, 51.1300, 10, now(),
       'sightings-private', '1111/b7.jpg', '0f0f0f0f0f0f0f0f', 'fake', (select value from v where name = 'faces')) as r) as x),
  row('accepted', 'false')::text,
  'twarz osoby trzeciej: zaliczone, ale nie na publiczną mapę'
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
  null,
  'świeże zgłoszenie czeka godzinę, zanim trafi na listę zaległych'
);
update public.sightings set created_at = now() - interval '2 hours' where id = 'bbbbbbbb-0000-0000-0000-000000000004';
select is(
  (select array_agg(id) from public.list_pending_sightings('22222222-2222-2222-2222-222222222222')),
  array['bbbbbbbb-0000-0000-0000-000000000004'::uuid],
  'lista zaległych zgłoszeń'
);
-- Cofnięcie daty (w pobliżu północy 2 h wstecz wypadłoby we wczorajszy dzień i zaburzyło dzienny limit).
update public.sightings set created_at = now() where id = 'bbbbbbbb-0000-0000-0000-000000000004';
create temporary table first_resolve as
  select public.resolve_pending('bbbbbbbb-0000-0000-0000-000000000004', 'map-photos', 'bbbbbbbb-0000-0000-0000-000000000004.jpg', 'gemini',
    (select value from v where name = 'three')) as r;
select is(
  (select r ->> 'tokens_awarded' from first_resolve),
  '30',
  'rozstrzygnięte zgłoszenie daje raciki'
);
select is(
  (select r ->> 'applied' from first_resolve),
  'true',
  'pierwsze rozstrzygnięcie zgłasza applied = true'
);
select is(
  (select public.resolve_pending('bbbbbbbb-0000-0000-0000-000000000004', 'map-photos', 'y.jpg', 'gemini', (select value from v where name = 'three')) ->> 'applied'),
  'false',
  'powtórne rozstrzygnięcie zgłasza applied = false'
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
select public.record_sighting('bbbbbbbb-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 17.0590, 51.1110, 10, now(),
  'sightings-private', '2222/b5.jpg', '0123456789abcdef', 'gemini', null);
update public.sightings set created_at = now() - interval '2 hours' where id = 'bbbbbbbb-0000-0000-0000-000000000005';
select public.fail_verification('bbbbbbbb-0000-0000-0000-000000000005');
select is(
  (select array_agg(id) from public.list_pending_sightings('22222222-2222-2222-2222-222222222222')),
  null,
  'po nieudanej próbie zgłoszenie nie wraca na listę od razu'
);
update public.sightings set last_verify_attempt_at = now() - interval '3 hours' where id = 'bbbbbbbb-0000-0000-0000-000000000005';
select is(
  (select array_agg(id) from public.list_pending_sightings('22222222-2222-2222-2222-222222222222')),
  array['bbbbbbbb-0000-0000-0000-000000000005'::uuid],
  'po 2 h od próby (odstęp po pierwszej porażce) zgłoszenie wraca na listę'
);
update public.sightings set created_at = now() where id = 'bbbbbbbb-0000-0000-0000-000000000005';
do $$
begin
  perform public.fail_verification('bbbbbbbb-0000-0000-0000-000000000005') from generate_series(1, 4);
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

-- 29–33: okno cooldownu z dwóch stron i weryfikacja fail-closed (użytkownik 3)
-- (a) stare zgłoszenie pending sprzed 2 dni, potem zaliczone w tym samym miejscu teraz
select public.record_sighting('cccccccc-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 17.0320, 51.1100, 10, now(),
  'sightings-private', '3333/c1.jpg', '1111111111111111', 'gemini', null);
update public.sightings set created_at = now() - interval '2 days' where id = 'cccccccc-0000-0000-0000-000000000001';
select public.record_sighting('cccccccc-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 17.0320, 51.1100, 10, now(),
  'sightings-private', '3333/c2.jpg', '2222222222222222', 'fake', (select value from v where name = 'three'));
select is(
  public.resolve_pending('cccccccc-0000-0000-0000-000000000001', 'map-photos', 'c1.jpg', 'gemini',
    (select value from v where name = 'three')) ->> 'status',
  'accepted',
  'późniejsze zgłoszenie (2 dni) nie anuluje punktów starego pending'
);

-- (b) zaliczone zgłoszenie w tym samym miejscu 10 minut wcześniej
select public.record_sighting('cccccccc-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 17.0590, 51.1110, 10, now(),
  'sightings-private', '3333/c3.jpg', '3333333333333333', 'gemini', null);
select public.record_sighting('cccccccc-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333', 17.0590, 51.1110, 10, now(),
  'sightings-private', '3333/c4.jpg', '4444444444444444', 'fake', (select value from v where name = 'three'));
update public.sightings set created_at = (select created_at from public.sightings where id = 'cccccccc-0000-0000-0000-000000000003') - interval '10 minutes'
  where id = 'cccccccc-0000-0000-0000-000000000004';
select is(
  public.resolve_pending('cccccccc-0000-0000-0000-000000000003', 'map-photos', 'c3.jpg', 'gemini',
    (select value from v where name = 'three')) ->> 'status',
  'accepted_no_points',
  'zaliczone 10 min wcześniej w tym samym miejscu daje brak punktów'
);

-- fail-closed
select public.record_sighting('cccccccc-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 17.0450, 51.1250, 10, now(),
  'sightings-private', '3333/c5.jpg', '5555555555555555', 'gemini', null);
select throws_ok(
  $$ select public.resolve_pending('cccccccc-0000-0000-0000-000000000005', 'map-photos', 'c5.jpg', 'gemini', '{}'::jsonb) $$,
  '22023',
  'invalid verification',
  'pusta odpowiedź weryfikatora jest błędem'
);
select is(
  (select status from public.sightings where id = 'cccccccc-0000-0000-0000-000000000005'),
  'pending',
  'po błędnej odpowiedzi zgłoszenie dalej czeka'
);
select throws_ok(
  $$ select public.record_sighting('cccccccc-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', 17.0450, 51.1250, 10, now(),
       'sightings-private', '3333/c6.jpg', '6666666666666666', 'fake', '{"ratCount":1}'::jsonb) $$,
  '22023',
  'invalid verification',
  'niekompletna odpowiedź przy zapisie jest błędem'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select is(
  (select count(*)::int from public.sightings) + (select count(*)::int from public.token_ledger) * 100,
  304,
  'użytkownik widzi tylko swoje 4 zgłoszenia i 3 wpisy dziennika (cooldown nie daje wpisu)'
);

select * from finish();
rollback;
