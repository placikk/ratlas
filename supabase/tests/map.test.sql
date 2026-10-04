begin;
select plan(19);

delete from public.reports;
delete from public.sightings;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ala@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ola@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'ewa@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'iza@example.com'),
  ('55555555-5555-5555-5555-555555555555', 'ula@example.com');

update public.profiles set nickname = 'Ala' where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set nickname = 'Ola', show_nickname_on_map = false where id = '22222222-2222-2222-2222-222222222222';

create temporary table v (name text primary key, value jsonb);
insert into v values
  ('three', '{"ratCount":3,"isSelfie":false,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":[],"raw":{}}'),
  ('one', '{"ratCount":1,"isSelfie":false,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":[],"raw":{}}'),
  ('selfie', '{"ratCount":1,"isSelfie":true,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":[],"raw":{}}'),
  ('none', '{"ratCount":0,"isSelfie":false,"isScreenOrPrint":false,"isToyOrDrawing":false,"hasThirdPartyFaces":false,"tags":[],"raw":{}}');

-- a1: Ala, Rynek, 3 szczury (publiczne); a2: Ola, pl. Grunwaldzki (publiczne, pseudonim ukryty);
-- a3: selfie Ali (niepubliczne); a4: odrzucone; a5: Ala, Ostrów Tumski, 8 dni temu; a6: oczekujące.
do $$
begin
  perform public.record_sighting('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 17.0320, 51.1100, 10, now(),
    'map-photos', 'a1.jpg', '0000000000000000', 'fake', (select value from v where name = 'three'));
  perform public.record_sighting('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 17.0590, 51.1110, 10, now(),
    'map-photos', 'a2.jpg', 'ffffffffffffffff', 'fake', (select value from v where name = 'one'));
  perform public.record_sighting('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 17.0330, 51.1105, 10, now(),
    'sightings-private', '1111/a3.jpg', '0f0f0f0f0f0f0f0f', 'fake', (select value from v where name = 'selfie'));
  perform public.record_sighting('aaaaaaaa-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 17.0400, 51.1150, 10, now(),
    'sightings-private', '2222/a4.jpg', 'f0f0f0f0f0f0f0f0', 'fake', (select value from v where name = 'none'));
  perform public.record_sighting('aaaaaaaa-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 17.0460, 51.1140, 10, now(),
    'map-photos', 'a5.jpg', '00ff00ff00ff00ff', 'fake', (select value from v where name = 'one'));
  perform public.record_sighting('aaaaaaaa-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 17.0200, 51.1050, 10, now(),
    'sightings-private', '2222/a6.jpg', 'ff00ff00ff00ff00', 'gemini', null);
end;
$$;
update public.sightings set created_at = now() - interval '8 days' where id = 'aaaaaaaa-0000-0000-0000-000000000005';

-- 1–3: uprawnienia
select ok(
  has_function_privilege('authenticated', 'public.sightings_in_view(double precision,double precision,double precision,double precision)', 'execute')
  and not has_function_privilege('anon', 'public.sightings_in_view(double precision,double precision,double precision,double precision)', 'execute'),
  'mapę widzą tylko zalogowani'
);
select ok(
  has_function_privilege('authenticated', 'public.report_sighting(uuid,text)', 'execute')
  and not has_function_privilege('anon', 'public.report_sighting(uuid,text)', 'execute'),
  'nadużycia zgłaszają tylko zalogowani'
);
select ok(
  not has_table_privilege('authenticated', 'public.reports', 'select')
  and not has_table_privilege('authenticated', 'public.reports', 'insert'),
  'tabela zgłoszeń nie jest wystawiona przez API'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- 4–8: zawartość mapy
select is(
  (select array_agg(id order by id) from public.sightings_in_view(16.8, 51.0, 17.2, 51.25)),
  array['aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002']::uuid[],
  'na mapie są tylko publiczne, nieukryte, zaakceptowane i świeże zgłoszenia'
);
select is(
  (select row(round(lon::numeric, 4), round(lat::numeric, 4), rats, photo_path, nickname, is_mine)::text
     from public.sightings_in_view(16.8, 51.0, 17.2, 51.25) where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  row(17.0320, 51.1100, 3, 'a1.jpg', 'Ala', true)::text,
  'pinezka ma współrzędne, liczbę szczurów, zdjęcie, pseudonim i oznaczenie „moja”'
);
select is(
  (select row(nickname, is_mine)::text from public.sightings_in_view(16.8, 51.0, 17.2, 51.25) where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  row(null::text, false)::text,
  'ukryty pseudonim nie trafia na mapę'
);
select is(
  (select array_agg(id) from public.sightings_in_view(17.05, 51.10, 17.07, 51.12)),
  array['aaaaaaaa-0000-0000-0000-000000000002']::uuid[],
  'mapa zwraca tylko pinezki z widocznego fragmentu'
);
select is(
  (select count(*)::int from public.sightings_in_view(20.9, 52.1, 21.1, 52.3)),
  0,
  'poza Wrocławiem nie ma pinezek'
);

select is(
  (select array_agg(id order by id) from public.sightings_in_view(-180, -85, 180, 85)),
  array['aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002']::uuid[],
  'widok całego świata zawiera pinezki'
);
select is(
  (select array_agg(id order by id) from public.sightings_in_view(-250, -85, 110, 85)),
  array['aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002']::uuid[],
  'zawinięty widok świata (poza ±180) zawiera pinezki'
);
select ok(
  exists (select 1 from public.sightings_in_view(-10, 50.5, 45, 65) where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'widok Europy zawiera pinezkę z Rynku'
);

-- 9–15: zgłaszanie nadużyć
select is(public.report_sighting('aaaaaaaa-0000-0000-0000-000000000001', 'not_rat'), 'own', 'własnej pinezki nie można zgłosić');

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select is(public.report_sighting('aaaaaaaa-0000-0000-0000-000000000001', 'not_rat'), 'reported', 'pierwsze zgłoszenie');
select is(public.report_sighting('aaaaaaaa-0000-0000-0000-000000000001', 'other'), 'already', 'jedna osoba zgłasza pinezkę raz');
select throws_ok(
  $$ select public.report_sighting('aaaaaaaa-0000-0000-0000-000000000002', 'nudne') $$,
  '23514', null, 'nieznany powód jest odrzucany'
);

set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select is(public.report_sighting('aaaaaaaa-0000-0000-0000-000000000001', 'inappropriate'), 'reported', 'drugie zgłoszenie');

set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
select is(public.report_sighting('aaaaaaaa-0000-0000-0000-000000000001', 'not_rat'), 'hidden', 'trzecie zgłoszenie ukrywa pinezkę');
select is(
  (select array_agg(id) from public.sightings_in_view(16.8, 51.0, 17.2, 51.25)),
  array['aaaaaaaa-0000-0000-0000-000000000002']::uuid[],
  'ukryta pinezka znika z mapy'
);

-- 16: niepublicznego zgłoszenia nie da się zgłosić
select is(public.report_sighting('aaaaaaaa-0000-0000-0000-000000000003', 'not_rat'), 'not_found', 'niepubliczne zgłoszenie jest niewidoczne');

select * from finish();
rollback;
