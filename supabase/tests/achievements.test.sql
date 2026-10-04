begin;
select plan(16);

delete from public.reports;
delete from public.sightings;

-- Test nie może zależeć od pory dnia: okno „Nocnego Marka” przesuwamy na godzinę (h+2)%24 czasu warszawskiego, a nie bieżącą.
create temporary table nh as
  select ((extract(hour from now() at time zone 'Europe/Warsaw')::int + 2) % 24) as hr;
update public.achievements
   set rule = jsonb_build_object('type', 'hour_between', 'from', (select hr from nh), 'to', (select hr from nh) + 1)
 where code = 'night_owl';

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
  select coalesce(array_agg(t.a ->> 'code' order by t.n), '{}') from jsonb_array_elements(p_result -> 'achievements') with ordinality as t(a, n)
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
   set created_at = (date_trunc('day', now() at time zone 'Europe/Warsaw') - interval '1 day' + make_interval(hours => (select hr from nh))) at time zone 'Europe/Warsaw'
 where id = 'a0000000-0000-0000-0000-000000000006';
select is(
  pg_temp.codes(public.resolve_pending('a0000000-0000-0000-0000-000000000006', 'map-photos', 'a6.jpg', 'gemini',
    (select value from v where name = 'one'))),
  array['rats_10', 'night_owl'],
  'zgłoszenie z godziny okna to Nocny Marek, a 10. szczur to Dziesiątka'
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
