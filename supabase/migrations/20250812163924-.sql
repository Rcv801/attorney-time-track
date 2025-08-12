-- Add color and hourly_rate to clients
alter table public.clients
  add column if not exists color text;

alter table public.clients
  add column if not exists hourly_rate numeric(12,2) not null default 0;

-- Index on user_id + archived for faster filtering (optional)
create index if not exists clients_user_archived_idx on public.clients(user_id, archived);
