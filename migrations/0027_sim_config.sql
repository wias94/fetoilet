create table if not exists sim_config (
  id integer primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into sim_config (id, data)
values (1, '{}'::jsonb)
on conflict (id) do nothing;
