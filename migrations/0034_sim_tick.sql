create table if not exists sim_runs (
  id text primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  uses int not null default 0,
  self_uses int not null default 0,
  buys int not null default 0,
  listed int not null default 0,
  stale int not null default 0,
  skipped int not null default 0,
  males int not null default 0,
  duration_ms int not null default 0,
  notes jsonb not null default '[]'::jsonb
);
create index if not exists sim_runs_started_idx on sim_runs (started_at desc);
