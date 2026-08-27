alter table stalls add column if not exists busy_until timestamptz;
alter table stalls add column if not exists busy_inquiry_id text;

create table if not exists behavior_satiation (
  male_id text not null,
  stall_id text not null,
  uses integer not null default 0,
  value real not null default 0,
  updated_at timestamptz not null default now(),
  primary key (male_id, stall_id)
);

create index if not exists stalls_busy_until_idx on stalls (busy_until) where busy_until is not null;
