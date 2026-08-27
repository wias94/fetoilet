create table if not exists behavior_econ (
  user_id text primary key references "user"(id) on delete cascade,
  cash_tight real not null default 0.4,
  bargain real not null default 0.4,
  flip real not null default 0.4,
  hold real not null default 0.4,
  rent real not null default 0.4,
  prestige real not null default 0.4,
  family_liquidate real not null default 0.4,
  use_over_own real not null default 0.4,
  updated_at timestamptz not null default now()
);
