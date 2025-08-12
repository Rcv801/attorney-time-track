-- Enforce single active timer per user
create unique index if not exists idx_entries_single_active
on public.entries(user_id)
where end_at is null;

-- Block additional sign-ups after the first user exists
create or replace function public.block_additional_signups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from auth.users) >= 1 then
    raise exception 'Sign-ups are disabled: this app is restricted to a single user.';
  end if;
  return new;
end;
$$;

drop trigger if exists block_additional_signups on auth.users;
create trigger block_additional_signups
before insert on auth.users
for each row execute procedure public.block_additional_signups();