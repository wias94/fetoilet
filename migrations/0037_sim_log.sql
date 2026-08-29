create table if not exists sim_log (
  id text primary key,
  run_id text,
  at timestamptz not null default now(),
  kind text not null,
  male_id text,
  stall_id text,
  name text not null default '',
  reason text not null default '',
  fen int not null default 0
);

create index if not exists sim_log_at_idx on sim_log (at desc);
create index if not exists sim_log_kind_idx on sim_log (kind, at desc);
