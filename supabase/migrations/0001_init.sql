-- CartRadar cloud schema. Run once in the Supabase SQL editor (or `supabase db push`).
-- Accounts, sessions and login codes are handled by Supabase Auth (auth.users), so they have no table here.
-- Conversation snippets ("heard") are never uploaded; they stay on the device.

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text,
  mobile     text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  zip               text not null default '',
  centre_lat        double precision,
  centre_lng        double precision,
  geofence_radius_m integer not null default 250,
  leftovers_to_cart boolean not null default false,
  reminders_enabled boolean not null default true,
  demo_mode         boolean not null default false,
  -- Decides which device wins for settings and stores together.
  updated_at        timestamptz not null default now()
);

create table if not exists public.stores (
  user_id    uuid not null references auth.users (id) on delete cascade,
  id         text not null,
  name       text not null,
  address    text,
  latitude   double precision not null,
  longitude  double precision not null,
  enabled    boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Today's list, the cart queue and history in one table. `archived` marks history (finished trips).
create table if not exists public.list_items (
  user_id      uuid not null references auth.users (id) on delete cascade,
  id           text not null,
  name         text not null,
  canonical    text not null,
  quantity     text,
  status       text not null check (status in ('open', 'bought', 'queued')),
  source       text not null check (source in ('bee', 'manual')),
  heard_text   text,
  carried_over integer not null default 0,
  archived     boolean not null default false,
  added_at     timestamptz not null,
  resolved_at  timestamptz,
  updated_at   timestamptz not null default now(),
  -- Soft delete, so a removal on one device reaches the others.
  deleted_at   timestamptz,
  primary key (user_id, id)
);

create index if not exists list_items_status_idx on public.list_items (user_id, status);
create index if not exists list_items_resolved_idx on public.list_items (user_id, resolved_at desc);
create index if not exists list_items_canonical_idx on public.list_items (user_id, canonical);

-- Row level security: a signed-in user can only see and change their own rows.
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.stores enable row level security;
alter table public.list_items enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own settings" on public.user_settings;
create policy "own settings" on public.user_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own stores" on public.stores;
create policy "own stores" on public.stores for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own items" on public.list_items;
create policy "own items" on public.list_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Creates the profile row when someone signs up (name comes from Google or from the login form).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
