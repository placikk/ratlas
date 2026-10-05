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
