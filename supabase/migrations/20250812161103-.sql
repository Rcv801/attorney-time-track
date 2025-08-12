-- Enable required extension for UUID generation
create extension if not exists pgcrypto;

-- PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- RLS: Only the owner can access their profile
drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "Users can delete their own profile" on public.profiles;
create policy "Users can delete their own profile"
on public.profiles
for delete
using (auth.uid() = id);

-- Automatically create a profile row for new users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, new.raw_user_meta_data->> 'email'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- CLIENTS TABLE
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists clients_user_id_idx on public.clients(user_id);
create index if not exists clients_name_idx on public.clients(name);

alter table public.clients enable row level security;

drop policy if exists "Clients are viewable by owner" on public.clients;
create policy "Clients are viewable by owner"
on public.clients
for select
using (user_id = auth.uid());

drop policy if exists "Clients are insertable by owner" on public.clients;
create policy "Clients are insertable by owner"
on public.clients
for insert
with check (user_id = auth.uid());

drop policy if exists "Clients are updatable by owner" on public.clients;
create policy "Clients are updatable by owner"
on public.clients
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Clients are deletable by owner" on public.clients;
create policy "Clients are deletable by owner"
on public.clients
for delete
using (user_id = auth.uid());

-- ENTRIES TABLE
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz,
  duration_sec int generated always as (
    case when end_at is not null then extract(epoch from (end_at - start_at))::int end
  ) stored,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists entries_user_id_idx on public.entries(user_id);
create index if not exists entries_client_id_idx on public.entries(client_id);
create index if not exists entries_start_at_idx on public.entries(start_at);

alter table public.entries enable row level security;

drop policy if exists "Entries are viewable by owner" on public.entries;
create policy "Entries are viewable by owner"
on public.entries
for select
using (user_id = auth.uid());

drop policy if exists "Entries are insertable by owner" on public.entries;
create policy "Entries are insertable by owner"
on public.entries
for insert
with check (user_id = auth.uid());

drop policy if exists "Entries are updatable by owner" on public.entries;
create policy "Entries are updatable by owner"
on public.entries
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Entries are deletable by owner" on public.entries;
create policy "Entries are deletable by owner"
on public.entries
for delete
using (user_id = auth.uid());

-- Generic trigger to set user_id from auth.uid() on insert
create or replace function public.set_auth_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_clients_user_id on public.clients;
create trigger set_clients_user_id
before insert on public.clients
for each row execute procedure public.set_auth_user_id();

drop trigger if exists set_entries_user_id on public.entries;
create trigger set_entries_user_id
before insert on public.entries
for each row execute procedure public.set_auth_user_id();

-- Ensure entries.user_id matches the client's user_id
create or replace function public.ensure_entry_user_matches_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  client_user uuid;
begin
  select user_id into client_user from public.clients where id = new.client_id;
  if client_user is null then
    raise exception 'Client (%) not found', new.client_id;
  end if;
  if new.user_id <> client_user then
    raise exception 'entries.user_id (%) must match clients.user_id (%)', new.user_id, client_user;
  end if;
  return new;
end;
$$;

drop trigger if exists entries_user_client_match on public.entries;
create trigger entries_user_client_match
before insert or update on public.entries
for each row execute procedure public.ensure_entry_user_matches_client();