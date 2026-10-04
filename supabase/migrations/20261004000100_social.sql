-- Ranking, zmiana pseudonimu, limity zgłoszeń nadużyć i sprzątanie odrzuconych zdjęć.

insert into public.app_config (key, value, description) values
  ('daily_report_limit', '10', 'Maksymalna liczba zgłoszeń nadużyć jednej osoby na dobę (czas polski)'),
  ('rejected_photo_retention_days', '30', 'Po ilu dniach usuwamy zdjęcia odrzuconych zgłoszeń');

alter table public.sightings add column photo_deleted_at timestamptz;

-- Edge Functions (service_role) czytają zgłoszenia także bezpośrednio (np. retry-pending).
grant select on public.sightings to service_role;

create function public.get_ranking(p_period text)
returns table (place bigint, nickname text, rats bigint, is_me boolean)
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
  select r.place, p.nickname, r.rats, r.user_id = (select auth.uid())
    from ranked r
    join public.profiles p on p.id = r.user_id
   where r.place <= 50 or r.user_id = (select auth.uid())
   order by r.place
$$;

create function public.change_nickname(p_nickname text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.profiles
     set nickname = p_nickname
   where id = auth.uid()
     and terms_accepted_at is not null;

  if not found then
    raise exception 'not onboarded' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.report_sighting(p_sighting_id uuid, p_reason text)
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

  -- Ochrona przed jednorazowymi kontami: zgłaszać mogą osoby z co najmniej jednym zaliczonym szczurem.
  if not exists (select 1 from public.sightings where user_id = v_user and status = 'accepted') then
    return 'not_allowed';
  end if;
  if exists (select 1 from public.reports where sighting_id = p_sighting_id and reporter_id = v_user) then
    return 'already';
  end if;
  if (select count(*) from public.reports where reporter_id = v_user and created_at >= public.warsaw_day_start())
     >= public.config_int('daily_report_limit') then
    return 'limit';
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

create function public.list_expired_rejected_photos(p_user_id uuid)
returns table (id uuid, photo_bucket text, photo_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.photo_bucket, s.photo_path
    from public.sightings s
   where s.user_id = p_user_id
     and s.status = 'rejected'
     and s.photo_deleted_at is null
     and s.created_at < now() - make_interval(days => public.config_int('rejected_photo_retention_days'))
   order by s.created_at
   limit 20
$$;

create function public.mark_photos_deleted(p_user_id uuid, p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.sightings
     set photo_deleted_at = now()
   where user_id = p_user_id
     and id = any (p_ids)
     and status = 'rejected'
     and photo_deleted_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.list_my_photo_paths(p_user_id uuid)
returns table (photo_bucket text, photo_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.photo_bucket, s.photo_path
    from public.sightings s
   where s.user_id = p_user_id
     and s.photo_deleted_at is null
$$;

revoke execute on function public.get_ranking(text) from public, anon, authenticated;
revoke execute on function public.change_nickname(text) from public, anon, authenticated;
revoke execute on function public.list_expired_rejected_photos(uuid) from public, anon, authenticated;
revoke execute on function public.mark_photos_deleted(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.list_my_photo_paths(uuid) from public, anon, authenticated;

grant execute on function public.get_ranking(text) to authenticated;
grant execute on function public.change_nickname(text) to authenticated;
grant execute on function public.list_expired_rejected_photos(uuid) to service_role;
grant execute on function public.mark_photos_deleted(uuid, uuid[]) to service_role;
grant execute on function public.list_my_photo_paths(uuid) to service_role;
