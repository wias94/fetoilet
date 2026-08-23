create table if not exists owner_tokens (
  user_id     text primary key,
  token       text not null unique,
  created_at  timestamptz not null default now()
);

alter table stalls add column if not exists owner_id text;

create index if not exists stalls_owner_idx on stalls (owner_id);

insert into owner_tokens (user_id, token)
values ('seed:owner', 'XC-SEEDDEMO')
on conflict (user_id) do nothing;

update stalls
set owner_id = 'seed:owner'
where user_id like 'seed:%' and owner_id is null;
