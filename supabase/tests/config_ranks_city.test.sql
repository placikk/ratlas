begin;
select plan(10);

select is(
  (select public.config_int('daily_submission_limit')),
  10,
  'domyślny dzienny limit to 10'
);

select is(
  (select count(*)::int from public.app_config),
  12,
  'konfiguracja ma 12 kluczy'
);

select is(
  (select array_agg(min_rats order by min_rats) from public.ranks),
  array[0, 5, 15, 40, 100, 250, 500],
  'progi rang zgodne ze specyfikacją'
);

select is(
  (select name from public.ranks where min_rats = 500),
  'Król Szczurów Wrocławia',
  'najwyższa ranga'
);

select ok(
  (select extensions.st_covers(geom, extensions.st_setsrid(extensions.st_makepoint(17.0320, 51.1100), 4326)::extensions.geography) from public.city_boundary),
  'Rynek leży we Wrocławiu'
);

select ok(
  not (select extensions.st_covers(geom, extensions.st_setsrid(extensions.st_makepoint(21.0122, 52.2297), 4326)::extensions.geography) from public.city_boundary),
  'Warszawa nie leży we Wrocławiu'
);

select ok(
  has_table_privilege('anon', 'public.app_config', 'select') and has_table_privilege('authenticated', 'public.ranks', 'select'),
  'konfigurację i rangi może czytać każdy'
);

select ok(
  not has_table_privilege('authenticated', 'public.app_config', 'update')
  and not has_table_privilege('authenticated', 'public.ranks', 'insert'),
  'użytkownik nie zmienia konfiguracji ani rang'
);

select ok(
  not has_table_privilege('authenticated', 'public.city_boundary', 'select'),
  'obrys miasta nie jest wystawiony przez API'
);

select ok(
  not has_function_privilege('authenticated', 'public.config_int(text)', 'execute')
  and not has_function_privilege('anon', 'public.warsaw_day_start()', 'execute'),
  'funkcje pomocnicze nie są wystawione przez API'
);

select * from finish();
rollback;
