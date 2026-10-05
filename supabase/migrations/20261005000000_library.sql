-- Szczurza Biblioteka: katalog nagród, zakupy za raciki, założony wygląd.
-- Produkcja ma wyłączone automatyczne udostępnianie — uprawnienia nadajemy jawnie.

create table public.reward_items (
  id text primary key,
  type text not null check (type in ('knowledge_card', 'quiz', 'pin_skin', 'title')),
  name text not null,
  teaser text not null,
  price integer not null check (price > 0),
  content jsonb not null default '{}',
  sort_order smallint not null unique,
  active boolean not null default true
);

alter table public.reward_items enable row level security;
revoke all on public.reward_items from anon, authenticated;

create table public.user_rewards (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.reward_items (id) on delete cascade,
  acquired_at timestamptz not null default now(),
  data jsonb not null default '{}',
  primary key (user_id, item_id)
);

alter table public.user_rewards enable row level security;
revoke all on public.user_rewards from anon, authenticated;

alter table public.profiles
  add column active_pin_skin text references public.reward_items (id) on delete set null,
  add column active_title text references public.reward_items (id) on delete set null;

-- Zakupy mają tekstowy identyfikator przedmiotu (ref_id to uuid zgłoszenia).
alter table public.token_ledger
  add column item_id text references public.reward_items (id) on delete set null;

create function public.library_catalog()
returns table (
  id text,
  type text,
  name text,
  teaser text,
  price integer,
  sort_order smallint,
  preview text,
  owned boolean,
  equipped boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Bez treści kart i quizów: te trafiają do aplikacji dopiero po zakupie (get_item_content).
  select i.id,
         i.type,
         i.name,
         i.teaser,
         i.price,
         i.sort_order,
         case i.type when 'pin_skin' then i.content ->> 'skin' when 'title' then i.content ->> 'label' end,
         ur.item_id is not null,
         coalesce(i.id = p.active_pin_skin or i.id = p.active_title, false)
    from public.reward_items i
    left join public.user_rewards ur on ur.item_id = i.id and ur.user_id = (select auth.uid())
    left join public.profiles p on p.id = (select auth.uid())
   where i.active
   order by i.sort_order
$$;

create function public.purchase_item(p_item_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_price integer;
  v_balance integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select price into v_price from public.reward_items where id = p_item_id and active;
  if v_price is null then
    return 'not_found';
  end if;

  -- Blokada profilu szereguje równoległe zakupy tej samej osoby.
  select tokens_balance into v_balance from public.profiles where id = v_user for update;

  if exists (select 1 from public.user_rewards where user_id = v_user and item_id = p_item_id) then
    return 'owned';
  end if;
  if v_balance < v_price then
    return 'insufficient';
  end if;

  insert into public.user_rewards (user_id, item_id) values (v_user, p_item_id);
  insert into public.token_ledger (user_id, delta, reason, item_id) values (v_user, -v_price, 'purchase', p_item_id);
  update public.profiles set tokens_balance = tokens_balance - v_price where id = v_user;
  return 'purchased';
end;
$$;

create function public.get_item_content(p_item_id text)
returns table (content jsonb, data jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select i.content, ur.data
    from public.user_rewards ur
    join public.reward_items i on i.id = ur.item_id
   where ur.user_id = (select auth.uid())
     and ur.item_id = p_item_id
$$;

create function public.save_quiz_result(p_item_id text, p_score integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_questions integer;
  v_best integer;
begin
  select jsonb_array_length(i.content -> 'questions') into v_questions
    from public.user_rewards ur
    join public.reward_items i on i.id = ur.item_id
   where ur.user_id = auth.uid()
     and ur.item_id = p_item_id
     and i.type = 'quiz';

  if v_questions is null then
    raise exception 'not owned' using errcode = 'P0001';
  end if;
  if p_score is null or p_score < 0 or p_score > v_questions then
    raise exception 'invalid score' using errcode = '22023';
  end if;

  update public.user_rewards
     set data = jsonb_set(data, '{best_score}', to_jsonb(greatest(coalesce((data ->> 'best_score')::integer, 0), p_score)))
   where user_id = auth.uid() and item_id = p_item_id
  returning (data ->> 'best_score')::integer into v_best;

  return v_best;
end;
$$;

create function public.set_equipped(p_type text, p_item_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_type not in ('pin_skin', 'title') then
    return 'invalid';
  end if;

  if p_item_id is not null then
    if not exists (select 1 from public.reward_items where id = p_item_id and type = p_type) then
      return 'invalid';
    end if;
    if not exists (select 1 from public.user_rewards where user_id = v_user and item_id = p_item_id) then
      return 'not_owned';
    end if;
  end if;

  if p_type = 'pin_skin' then
    update public.profiles set active_pin_skin = p_item_id where id = v_user;
  else
    update public.profiles set active_title = p_item_id where id = v_user;
  end if;
  return 'ok';
end;
$$;

revoke execute on function public.library_catalog() from public, anon, authenticated;
revoke execute on function public.purchase_item(text) from public, anon, authenticated;
revoke execute on function public.get_item_content(text) from public, anon, authenticated;
revoke execute on function public.save_quiz_result(text, integer) from public, anon, authenticated;
revoke execute on function public.set_equipped(text, text) from public, anon, authenticated;

grant execute on function public.library_catalog() to authenticated;
grant execute on function public.purchase_item(text) to authenticated;
grant execute on function public.get_item_content(text) to authenticated;
grant execute on function public.save_quiz_result(text, integer) to authenticated;
grant execute on function public.set_equipped(text, text) to authenticated;
