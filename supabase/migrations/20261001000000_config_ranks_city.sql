-- Konfiguracja gry, rangi i obrys Wrocławia.
-- Produkcja ma wyłączone automatyczne udostępnianie tabel: uprawnienia nadajemy jawnie.
create extension if not exists postgis with schema extensions;

create table public.app_config (
  key text primary key,
  value jsonb not null,
  description text not null
);

alter table public.app_config enable row level security;

create policy "app_config: everyone can read"
  on public.app_config for select to anon, authenticated
  using (true);

revoke all on public.app_config from anon, authenticated;
grant select on public.app_config to anon, authenticated;

insert into public.app_config (key, value, description) values
  ('daily_submission_limit', '10', 'Maksymalna liczba zgłoszeń jednej osoby na dobę (czas polski)'),
  ('cooldown_radius_m', '50', 'Promień, w którym kolejne zgłoszenie tej samej osoby nie daje punktów'),
  ('cooldown_minutes', '30', 'Czas, przez który obowiązuje cooldown miejsca'),
  ('max_rats_per_photo', '5', 'Maksymalna liczba szczurów zaliczanych z jednego zdjęcia'),
  ('tokens_per_rat', '10', 'Raciki za jednego zaliczonego szczura'),
  ('pin_fade_days', '7', 'Po ilu dniach pinezka znika z mapy'),
  ('map_location_precision', '"exact"', 'Dokładność lokalizacji na mapie: exact albo fuzzy'),
  ('duplicate_hamming_threshold', '6', 'Maksymalna odległość Hamminga odcisków zdjęć uznawanych za duplikat'),
  ('duplicate_window_days', '30', 'Z ilu ostatnich dni porównujemy zdjęcia w poszukiwaniu duplikatów'),
  ('reports_to_hide', '3', 'Po ilu zgłoszeniach nadużycia pinezka się ukrywa'),
  ('max_verify_attempts', '5', 'Po ilu nieudanych próbach weryfikacji zgłoszenie jest odrzucane'),
  ('gps_max_accuracy_m', '100', 'Najgorsza akceptowana dokładność GPS w metrach');

create function public.config_int(p_key text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (value #>> '{}')::integer from public.app_config where key = p_key
$$;

create function public.warsaw_day_start()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select date_trunc('day', now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw'
$$;

revoke execute on function public.config_int(text) from public, anon, authenticated;
revoke execute on function public.warsaw_day_start() from public, anon, authenticated;

create table public.ranks (
  id smallint primary key,
  name text not null,
  min_rats integer not null unique check (min_rats >= 0)
);

alter table public.ranks enable row level security;

create policy "ranks: everyone can read"
  on public.ranks for select to anon, authenticated
  using (true);

revoke all on public.ranks from anon, authenticated;
grant select on public.ranks to anon, authenticated;

insert into public.ranks (id, name, min_rats) values
  (1, 'Szczurzy Nowicjusz', 0),
  (2, 'Podwórkowy Obserwator', 5),
  (3, 'Tropiciel z Nadodrza', 15),
  (4, 'Kanałowy Zwiadowca', 40),
  (5, 'Łowca z Rynku', 100),
  (6, 'Szczurołap', 250),
  (7, 'Król Szczurów Wrocławia', 500);

-- Obrys miasta: dane wstawia kolejna (wygenerowana) migracja.
create table public.city_boundary (
  id smallint primary key default 1 check (id = 1),
  name text not null,
  geom extensions.geography(MultiPolygon, 4326) not null
);

alter table public.city_boundary enable row level security;
revoke all on public.city_boundary from anon, authenticated;
