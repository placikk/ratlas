-- Profil gracza: tworzony automatycznie przy rejestracji, uzupełniany w onboardingu.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text,
  show_nickname_on_map boolean not null default true,
  total_rats integer not null default 0 check (total_rats >= 0),
  tokens_balance integer not null default 0 check (tokens_balance >= 0),
  training_consent boolean not null default false,
  age_confirmed boolean not null default false,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint profiles_nickname_format
    check (nickname is null or nickname ~ '^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż_-]{3,20}$'),
  constraint profiles_onboarded_has_nickname
    check (terms_accepted_at is null or nickname is not null)
);

create unique index profiles_nickname_lower_idx on public.profiles (lower(nickname));

alter table public.profiles enable row level security;

create policy "profiles: owner can read"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: owner can update"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Użytkownik może zmieniać tylko ustawienia; punkty, tokeny, pseudonim i akceptację regulaminu zmienia wyłącznie serwer.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (show_nickname_on_map, training_consent) on public.profiles to authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.complete_onboarding(p_nickname text, p_training_consent boolean)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.profiles
     set nickname = p_nickname,
         training_consent = p_training_consent,
         age_confirmed = true,
         terms_accepted_at = now()
   where id = auth.uid()
     and terms_accepted_at is null
  returning * into result;

  if result.id is null then
    raise exception 'already onboarded' using errcode = 'P0001';
  end if;

  return result;
end;
$$;

revoke execute on function public.complete_onboarding(text, boolean) from public, anon;
grant execute on function public.complete_onboarding(text, boolean) to authenticated;
