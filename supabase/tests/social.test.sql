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
