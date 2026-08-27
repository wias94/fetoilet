alter table stalls add column if not exists owned_at timestamptz;

update stalls
set owned_at = coalesce(owned_at, created_at, now())
where owner_id is not null and owned_at is null;

insert into wallets (user_id, fen) values ('platform', 0)
on conflict (user_id) do nothing;
