-- Skórka pinezki i tytuł właściciela widoczne na mapie i w rankingu.
-- Zmiana zwracanych kolumn wymaga ponownego utworzenia funkcji i nadania uprawnień.

drop function public.sightings_in_view(double precision, double precision, double precision, double precision);

create function public.sightings_in_view(
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision
)
returns table (
  id uuid,
  lon double precision,
  lat double precision,
  rats integer,
  created_at timestamptz,
  photo_path text,
  nickname text,
  is_mine boolean,
  skin text,
  title text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id,
         extensions.st_x(s.location::extensions.geometry),
         extensions.st_y(s.location::extensions.geometry),
         least(coalesce(s.rats_detected, 0), public.config_int('max_rats_per_photo')),
         s.created_at,
         s.photo_path,
         case when p.show_nickname_on_map then p.nickname end,
         s.user_id = (select auth.uid()),
         skin_item.content ->> 'skin',
         case when p.show_nickname_on_map then title_item.content ->> 'label' end
    from public.sightings s
    join public.profiles p on p.id = s.user_id
    left join public.reward_items skin_item on skin_item.id = p.active_pin_skin
    left join public.reward_items title_item on title_item.id = p.active_title
   where s.status in ('accepted', 'accepted_no_points')
     and s.public_on_map
     and not s.hidden
     and s.created_at > now() - make_interval(days => public.config_int('pin_fade_days'))
     and s.photo_bucket = 'map-photos'
     and extensions.st_intersects(
           s.location::extensions.geometry,
           extensions.st_makeenvelope(greatest(p_west, -180), greatest(p_south, -90), least(p_east, 180), least(p_north, 90), 4326)
         )
   order by s.created_at desc
   limit 500
$$;

revoke execute on function public.sightings_in_view(double precision, double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.sightings_in_view(double precision, double precision, double precision, double precision) to authenticated;

drop function public.get_ranking(text);

create function public.get_ranking(p_period text)
returns table (place bigint, nickname text, rats bigint, is_me boolean, title text)
language sql
stable
security definer
set search_path = ''
as $$
  with scores as (
    select s.user_id, sum(s.rats_awarded)::bigint as rats, max(s.created_at) as last_at
      from public.sightings s
     where s.status = 'accepted'
       and s.rats_awarded > 0
       and not s.hidden
       and p_period in ('month', 'all')
       and (p_period = 'all'
            or s.created_at >= date_trunc('month', now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw')
     group by s.user_id
  ),
  ranked as (
    -- Remis: wyżej ten, kto osiągnął wynik wcześniej (wcześniejsze ostatnie zaliczone zgłoszenie).
    select sc.user_id, sc.rats, row_number() over (order by sc.rats desc, sc.last_at asc) as place
      from scores sc
      join public.profiles p on p.id = sc.user_id
     where p.nickname is not null
  )
  select r.place, p.nickname, r.rats, r.user_id = (select auth.uid()), title_item.content ->> 'label'
    from ranked r
    join public.profiles p on p.id = r.user_id
    left join public.reward_items title_item on title_item.id = p.active_title
   where r.place <= 50 or r.user_id = (select auth.uid())
   order by r.place
$$;

revoke execute on function public.get_ranking(text) from public, anon, authenticated;
grant execute on function public.get_ranking(text) to authenticated;
