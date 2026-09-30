-- Zgłoszenia szczurów, dziennik racików i funkcje naliczające punkty.
-- Wszystko, co zmienia punkty, wykonuje tylko service_role (Edge Functions).

create table public.sightings (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'accepted_no_points', 'rejected')),
  reject_reason text check (reject_reason in ('no_rat', 'screen_or_print', 'toy_or_drawing', 'verification_failed')),
  location extensions.geography(Point, 4326) not null,
  location_accuracy_m real not null,
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  photo_bucket text not null,
  photo_path text not null,
  phash bit(64) not null,
  rats_detected integer,
  rats_awarded integer not null default 0,
  tokens_awarded integer not null default 0,
  is_selfie boolean not null default false,
  has_third_party_faces boolean not null default false,
  tags text[] not null default '{}',
  public_on_map boolean not null default false,
  hidden boolean not null default false,
  verifier text,
  verifier_raw jsonb,
  verify_attempts integer not null default 0,
  last_verify_attempt_at timestamptz
);

create index sightings_user_created_idx on public.sightings (user_id, created_at desc);
create index sightings_created_idx on public.sightings (created_at);
create index sightings_location_idx on public.sightings using gist (location);

alter table public.sightings enable row level security;

create policy "sightings: owner can read"
  on public.sightings for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.sightings from anon, authenticated;
grant select on public.sightings to authenticated;

create table public.token_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('sighting', 'achievement', 'purchase', 'correction')),
  ref_id uuid,
  created_at timestamptz not null default now()
);

create index token_ledger_user_idx on public.token_ledger (user_id, created_at desc);

alter table public.token_ledger enable row level security;

create policy "token_ledger: owner can read"
  on public.token_ledger for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.token_ledger from anon, authenticated;
grant select on public.token_ledger to authenticated;

create function public.precheck_sighting(
  p_user_id uuid,
  p_lon double precision,
  p_lat double precision,
  p_accuracy_m real,
  p_phash text
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_point extensions.geography :=
    extensions.st_setsrid(extensions.st_makepoint(p_lon, p_lat), 4326)::extensions.geography;
begin
  if (select count(*) from public.sightings
       where user_id = p_user_id and created_at >= public.warsaw_day_start())
     >= public.config_int('daily_submission_limit') then
    return 'daily_limit';
  end if;

  if p_accuracy_m > public.config_int('gps_max_accuracy_m') then
    return 'gps_inaccurate';
  end if;

  if not exists (select 1 from public.city_boundary where extensions.st_covers(geom, v_point)) then
    return 'outside_city';
  end if;

  if exists (
    select 1 from public.sightings
     where created_at > now() - make_interval(days => public.config_int('duplicate_window_days'))
       and bit_count(phash # ('x' || p_phash)::bit(64)) <= public.config_int('duplicate_hamming_threshold')
  ) then
    return 'duplicate';
  end if;

  return null;
end;
$$;

create function public.sighting_result(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'status', s.status,
    'reject_reason', s.reject_reason,
    'rats_awarded', s.rats_awarded,
    'tokens_awarded', s.tokens_awarded,
    'public_on_map', s.public_on_map,
    'total_rats', p.total_rats,
    'tokens_balance', p.tokens_balance
  )
  from public.sightings s
  join public.profiles p on p.id = s.user_id
  where s.id = p_id
$$;

create function public.apply_verification(p_id uuid, p_verification jsonb, p_verifier text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.sightings;
  v_detected integer := (p_verification ->> 'ratCount')::integer;
  v_rats integer;
  v_status text;
  v_reason text;
  v_tokens integer := 0;
  v_selfie boolean := coalesce((p_verification ->> 'isSelfie')::boolean, false);
  v_faces boolean := coalesce((p_verification ->> 'hasThirdPartyFaces')::boolean, false);
begin
  -- Fail closed: niekompletna odpowiedź weryfikatora nigdy nie zalicza zgłoszenia.
  if p_verification is null
     or p_verification ->> 'ratCount' is null
     or p_verification ->> 'isSelfie' is null
     or p_verification ->> 'isScreenOrPrint' is null
     or p_verification ->> 'isToyOrDrawing' is null
     or p_verification ->> 'hasThirdPartyFaces' is null then
    raise exception 'invalid verification' using errcode = '22023';
  end if;

  select * into s from public.sightings where id = p_id for update;
  -- Idempotentnie: rozstrzygamy tylko zgłoszenia, które wciąż czekają.
  if s.id is null or s.status <> 'pending' then
    return;
  end if;

  v_rats := least(greatest(v_detected, 0), public.config_int('max_rats_per_photo'));

  if v_detected <= 0 then
    v_status := 'rejected';
    v_reason := 'no_rat';
  elsif (p_verification ->> 'isScreenOrPrint')::boolean then
    v_status := 'rejected';
    v_reason := 'screen_or_print';
  elsif (p_verification ->> 'isToyOrDrawing')::boolean then
    v_status := 'rejected';
    v_reason := 'toy_or_drawing';
  elsif exists (
    select 1 from public.sightings o
     where o.user_id = s.user_id
       and o.id <> s.id
       and o.status = 'accepted'
       and o.created_at between s.created_at - make_interval(mins => public.config_int('cooldown_minutes'))
                            and s.created_at + make_interval(mins => public.config_int('cooldown_minutes'))
       and extensions.st_dwithin(o.location, s.location, public.config_int('cooldown_radius_m'))
  ) then
    v_status := 'accepted_no_points';
  else
    v_status := 'accepted';
    v_tokens := v_rats * public.config_int('tokens_per_rat');
  end if;

  update public.sightings
     set status = v_status,
         reject_reason = v_reason,
         rats_detected = v_detected,
         rats_awarded = case when v_status = 'accepted' then v_rats else 0 end,
         tokens_awarded = v_tokens,
         is_selfie = v_selfie,
         has_third_party_faces = v_faces,
         tags = coalesce(array(select jsonb_array_elements_text(p_verification -> 'tags')), '{}'),
         public_on_map = v_status in ('accepted', 'accepted_no_points') and not v_selfie and not v_faces,
         verifier = p_verifier,
         verifier_raw = p_verification -> 'raw'
   where id = p_id;

  if v_status = 'accepted' then
    update public.profiles
       set total_rats = total_rats + v_rats,
           tokens_balance = tokens_balance + v_tokens
     where id = s.user_id;

    insert into public.token_ledger (user_id, delta, reason, ref_id)
    values (s.user_id, v_tokens, 'sighting', p_id);
  end if;
end;
$$;

create function public.record_sighting(
  p_id uuid,
  p_user_id uuid,
  p_lon double precision,
  p_lat double precision,
  p_accuracy_m real,
  p_captured_at timestamptz,
  p_photo_bucket text,
  p_photo_path text,
  p_phash text,
  p_verifier text,
  p_verification jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Blokada wiersza profilu szereguje równoległe zgłoszenia jednej osoby.
  perform 1 from public.profiles where id = p_user_id for update;

  if (select count(*) from public.sightings
       where user_id = p_user_id and created_at >= public.warsaw_day_start())
     >= public.config_int('daily_submission_limit') then
    return jsonb_build_object('status', 'blocked', 'reason', 'daily_limit');
  end if;

  insert into public.sightings (
    id, user_id, status, location, location_accuracy_m, captured_at,
    photo_bucket, photo_path, phash, verifier
  ) values (
    p_id, p_user_id, 'pending',
    extensions.st_setsrid(extensions.st_makepoint(p_lon, p_lat), 4326)::extensions.geography,
    p_accuracy_m, p_captured_at, p_photo_bucket, p_photo_path, ('x' || p_phash)::bit(64), p_verifier
  );

  if p_verification is not null then
    perform public.apply_verification(p_id, p_verification, p_verifier);
  end if;

  return public.sighting_result(p_id);
end;
$$;

create function public.resolve_pending(
  p_id uuid,
  p_photo_bucket text,
  p_photo_path text,
  p_verifier text,
  p_verification jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_applied boolean;
begin
  -- Wiersz zmienia tylko pierwsze wywołanie: UPDATE jest ograniczony do `pending`,
  -- a równoległe wywołanie czeka na blokadę i po jej zwolnieniu nie znajduje już wiersza.
  update public.sightings
     set photo_bucket = p_photo_bucket,
         photo_path = p_photo_path
   where id = p_id and status = 'pending';
  v_applied := found;

  if v_applied then
    perform public.apply_verification(p_id, p_verification, p_verifier);
  end if;
  return public.sighting_result(p_id) || jsonb_build_object('applied', v_applied);
end;
$$;

create function public.fail_verification(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sightings
     set verify_attempts = verify_attempts + 1,
         last_verify_attempt_at = now(),
         status = case when verify_attempts + 1 >= public.config_int('max_verify_attempts') then 'rejected' else status end,
         reject_reason = case when verify_attempts + 1 >= public.config_int('max_verify_attempts') then 'verification_failed' else reject_reason end
   where id = p_id and status = 'pending';

  return public.sighting_result(p_id);
end;
$$;

create function public.list_pending_sightings(p_user_id uuid)
returns table (id uuid, photo_bucket text, photo_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.photo_bucket, s.photo_path
    from public.sightings s
   where s.user_id = p_user_id and s.status = 'pending'
     -- Rosnący odstęp: 1 h, 2 h, 4 h, 8 h, 16 h od poprzedniej próby.
     and coalesce(s.last_verify_attempt_at, s.created_at) < now() - interval '1 hour' * power(2, s.verify_attempts)
   order by s.created_at
   limit 5
$$;

revoke execute on function public.precheck_sighting(uuid, double precision, double precision, real, text) from public, anon, authenticated;
revoke execute on function public.sighting_result(uuid) from public, anon, authenticated;
revoke execute on function public.apply_verification(uuid, jsonb, text) from public, anon, authenticated;
revoke execute on function public.record_sighting(uuid, uuid, double precision, double precision, real, timestamptz, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.resolve_pending(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.fail_verification(uuid) from public, anon, authenticated;
revoke execute on function public.list_pending_sightings(uuid) from public, anon, authenticated;

grant execute on function public.precheck_sighting(uuid, double precision, double precision, real, text) to service_role;
grant execute on function public.record_sighting(uuid, uuid, double precision, double precision, real, timestamptz, text, text, text, text, jsonb) to service_role;
grant execute on function public.resolve_pending(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.fail_verification(uuid) to service_role;
grant execute on function public.list_pending_sightings(uuid) to service_role;
