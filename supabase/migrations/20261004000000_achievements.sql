-- Osiągnięcia: jawne i ukryte, przyznawane przy zaliczonym zgłoszeniu w tej samej transakcji co punkty.
-- Produkcja ma wyłączone automatyczne udostępnianie — uprawnienia nadajemy jawnie.

create table public.achievements (
  code text primary key,
  name text not null,
  description text not null,
  secret boolean not null default false,
  reward_tokens integer not null check (reward_tokens >= 0),
  rule jsonb not null,
  sort_order smallint not null unique
);

alter table public.achievements enable row level security;
revoke all on public.achievements from anon, authenticated;

insert into public.achievements (code, name, description, secret, reward_tokens, rule, sort_order) values
  ('first_rat', 'Pierwszy szczur', 'Zalicz swojego pierwszego szczura.', false, 25, '{"type":"total_rats_gte","value":1}', 1),
  ('rats_10', 'Dziesiątka', 'Zalicz 10 szczurów.', false, 30, '{"type":"total_rats_gte","value":10}', 2),
  ('rats_50', 'Pół setki', 'Zalicz 50 szczurów.', false, 40, '{"type":"total_rats_gte","value":50}', 3),
  ('rats_100', 'Setka', 'Zalicz 100 szczurów.', false, 50, '{"type":"total_rats_gte","value":100}', 4),
  ('nest', 'Gniazdo', 'Zalicz 5 szczurów na jednym zdjęciu.', false, 50, '{"type":"rats_in_photo_gte","value":5}', 5),
  ('streak_7', 'Seria', 'Zaliczaj szczura 7 dni z rzędu.', false, 50, '{"type":"streak_days_gte","value":7}', 6),
  ('selfie', 'Szczurze Selfie', 'Zrób sobie selfie ze szczurem.', true, 75, '{"type":"selfie"}', 7),
  ('night_owl', 'Nocny Marek', 'Wypatrz szczura między północą a 4:00.', true, 75, '{"type":"hour_between","from":0,"to":4}', 8),
  ('trash_gourmet', 'Śmietnikowy Smakosz', 'Przyłap szczura przy śmietniku.', true, 75, '{"type":"tag","value":"smietnik"}', 9),
  ('dwarf_friend', 'Szczur i Krasnal', 'Sfotografuj szczura przy wrocławskim krasnalu.', true, 100, '{"type":"tag","value":"krasnal"}', 10),
  ('odra_wolf', 'Odrzański Wilk', 'Wypatrz szczura nad wodą.', true, 75, '{"type":"tag","value":"woda"}', 11),
  ('mpk_passenger', 'Pasażer MPK', 'Spotkaj szczura przy tramwaju albo przystanku.', true, 75, '{"type":"tag","value":"tramwaj_przystanek"}', 12),
  ('wet_fur', 'Mokry Futrzak', 'Znajdź szczura w deszczu.', true, 75, '{"type":"tag","value":"deszcz"}', 13);

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_code text not null references public.achievements (code) on delete cascade,
  sighting_id uuid references public.sightings (id) on delete set null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_code)
);

create index user_achievements_sighting_idx on public.user_achievements (sighting_id);

alter table public.user_achievements enable row level security;
revoke all on public.user_achievements from anon, authenticated;

create function public.achievement_rule_matches(p_rule jsonb, p_sighting public.sightings, p_total_rats integer)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hour integer := extract(hour from p_sighting.created_at at time zone 'Europe/Warsaw');
  v_day date := (p_sighting.created_at at time zone 'Europe/Warsaw')::date;
  v_days integer;
begin
  case p_rule ->> 'type'
    when 'total_rats_gte' then
      return p_total_rats >= (p_rule ->> 'value')::integer;
    when 'rats_in_photo_gte' then
      return p_sighting.rats_awarded >= (p_rule ->> 'value')::integer;
    when 'selfie' then
      return p_sighting.is_selfie;
    when 'tag' then
      return (p_rule ->> 'value') = any (p_sighting.tags);
    when 'hour_between' then
      return v_hour >= (p_rule ->> 'from')::integer and v_hour < (p_rule ->> 'to')::integer;
    when 'streak_days_gte' then
      select count(distinct (o.created_at at time zone 'Europe/Warsaw')::date) into v_days
        from public.sightings o
       where o.user_id = p_sighting.user_id
         and o.status = 'accepted'
         and (o.created_at at time zone 'Europe/Warsaw')::date
             between v_day - ((p_rule ->> 'value')::integer - 1) and v_day;
      return v_days >= (p_rule ->> 'value')::integer;
    else
      return false;
  end case;
end;
$$;

create function public.evaluate_achievements(p_sighting_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.sightings;
  v_total integer;
  a public.achievements;
  v_reward integer := 0;
begin
  select * into s from public.sightings where id = p_sighting_id;
  if s.id is null or s.status <> 'accepted' then
    return;
  end if;
  select total_rats into v_total from public.profiles where id = s.user_id;

  for a in select * from public.achievements order by sort_order loop
    continue when exists (
      select 1 from public.user_achievements ua where ua.user_id = s.user_id and ua.achievement_code = a.code
    );
    continue when not public.achievement_rule_matches(a.rule, s, v_total);

    insert into public.user_achievements (user_id, achievement_code, sighting_id) values (s.user_id, a.code, s.id);
    if a.reward_tokens > 0 then
      insert into public.token_ledger (user_id, delta, reason, ref_id) values (s.user_id, a.reward_tokens, 'achievement', s.id);
      v_reward := v_reward + a.reward_tokens;
    end if;
  end loop;

  if v_reward > 0 then
    update public.profiles set tokens_balance = tokens_balance + v_reward where id = s.user_id;
  end if;
end;
$$;

-- Ta sama logika co w planie 2 (dwustronny cooldown, fail closed), plus osiągnięcia dla zaliczonych zgłoszeń.
create or replace function public.apply_verification(p_id uuid, p_verification jsonb, p_verifier text)
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

    perform public.evaluate_achievements(p_id);
  end if;
end;
$$;

create or replace function public.sighting_result(p_id uuid)
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
    'tokens_balance', p.tokens_balance,
    'achievements', coalesce((
      select jsonb_agg(
               jsonb_build_object('code', a.code, 'name', a.name, 'secret', a.secret, 'reward_tokens', a.reward_tokens)
               order by a.sort_order)
        from public.user_achievements ua
        join public.achievements a on a.code = ua.achievement_code
       where ua.sighting_id = s.id
    ), '[]'::jsonb)
  )
  from public.sightings s
  join public.profiles p on p.id = s.user_id
  where s.id = p_id
$$;

create function public.my_achievements()
returns table (
  sort_order smallint,
  code text,
  name text,
  description text,
  secret boolean,
  reward_tokens integer,
  unlocked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Nieodkryte sekrety nie zdradzają kodu, nazwy, opisu ani nagrody.
  select a.sort_order,
         case when not a.secret or ua.unlocked_at is not null then a.code end,
         case when not a.secret or ua.unlocked_at is not null then a.name end,
         case when not a.secret or ua.unlocked_at is not null then a.description end,
         a.secret,
         case when not a.secret or ua.unlocked_at is not null then a.reward_tokens end,
         ua.unlocked_at
    from public.achievements a
    left join public.user_achievements ua
      on ua.achievement_code = a.code and ua.user_id = (select auth.uid())
   order by a.sort_order
$$;

revoke execute on function public.achievement_rule_matches(jsonb, public.sightings, integer) from public, anon, authenticated;
revoke execute on function public.evaluate_achievements(uuid) from public, anon, authenticated;
revoke execute on function public.my_achievements() from public, anon, authenticated;
grant execute on function public.my_achievements() to authenticated;
