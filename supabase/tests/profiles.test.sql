begin;
select plan(9);

insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'ala@example.com'),
       ('22222222-2222-2222-2222-222222222222', 'ola@example.com');

select is(
  (select count(*)::int from public.profiles),
  2,
  'nowy użytkownik dostaje profil automatycznie'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  (select count(*)::int from public.profiles),
  1,
  'użytkownik widzi tylko własny profil'
);

select lives_ok(
  $$ select public.complete_onboarding('Szczurołap_1', true) $$,
  'onboarding z poprawnym pseudonimem się udaje'
);

select is(
  (select nickname from public.profiles),
  'Szczurołap_1',
  'pseudonim zapisany'
);

select throws_ok(
  $$ select public.complete_onboarding('Inny', false) $$,
  'P0001',
  'already onboarded',
  'onboardingu nie da się powtórzyć'
);

select throws_ok(
  $$ update public.profiles set total_rats = 999 $$,
  '42501',
  null,
  'użytkownik nie może sam zmienić liczby szczurów'
);

select lives_ok(
  $$ update public.profiles set show_nickname_on_map = false $$,
  'użytkownik może zmienić ustawienie widoczności pseudonimu'
);

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select throws_ok(
  $$ select public.complete_onboarding('szczurołap_1', false) $$,
  '23505',
  null,
  'pseudonim jest unikalny bez względu na wielkość liter'
);

select throws_ok(
  $$ select public.complete_onboarding('a b', false) $$,
  '23514',
  null,
  'pseudonim w złym formacie jest odrzucany'
);

select * from finish();
rollback;
