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
