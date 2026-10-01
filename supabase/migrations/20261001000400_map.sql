-- Mapa: publiczne pinezki i zgłaszanie nadużyć.
-- Produkcja ma wyłączone automatyczne udostępnianie — uprawnienia nadajemy jawnie.

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
  is_mine boolean
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
         s.user_id = (select auth.uid())
    from public.sightings s
    join public.profiles p on p.id = s.user_id
   where s.status in ('accepted', 'accepted_no_points')
     and s.public_on_map
     and not s.hidden
     and s.created_at > now() - make_interval(days => public.config_int('pin_fade_days'))
     and extensions.st_intersects(
           s.location,
           extensions.st_makeenvelope(p_west, p_south, p_east, p_north, 4326)::extensions.geography
         )
   order by s.created_at desc
   limit 500
$$;

revoke execute on function public.sightings_in_view(double precision, double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.sightings_in_view(double precision, double precision, double precision, double precision) to authenticated;

create table public.reports (
  id bigint generated always as identity primary key,
  sighting_id uuid not null references public.sightings (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('not_rat', 'inappropriate', 'other')),
  created_at timestamptz not null default now(),
  unique (sighting_id, reporter_id)
);

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

create function public.report_sighting(p_sighting_id uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_reports integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Zgłosić można tylko to, co widać na mapie.
  select s.user_id into v_owner
    from public.sightings s
   where s.id = p_sighting_id
     and s.public_on_map
     and not s.hidden
     and s.status in ('accepted', 'accepted_no_points')
   for update;

  if v_owner is null then
    return 'not_found';
  end if;
  if v_owner = v_user then
    return 'own';
  end if;

  insert into public.reports (sighting_id, reporter_id, reason)
  values (p_sighting_id, v_user, p_reason)
  on conflict (sighting_id, reporter_id) do nothing;
  if not found then
    return 'already';
  end if;

  select count(*) into v_reports from public.reports where sighting_id = p_sighting_id;
  if v_reports >= public.config_int('reports_to_hide') then
    update public.sightings set hidden = true where id = p_sighting_id;
    return 'hidden';
  end if;

  return 'reported';
end;
$$;

revoke execute on function public.report_sighting(uuid, text) from public, anon, authenticated;
grant execute on function public.report_sighting(uuid, text) to authenticated;
