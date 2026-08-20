create table if not exists stalls (
  id          text primary key,
  user_id     text not null unique,
  name        text not null,
  age         integer not null,
  height_cm   integer not null,
  cup         text not null,
  area        text not null,
  tags        jsonb not null,
  image       text not null,
  online      boolean not null default true,
  hour_fen    integer not null,
  night_fen   integer not null,
  eta_min     integer not null,
  places      jsonb not null,
  bio         text not null,
  services    jsonb not null,
  work        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists stalls_online_idx on stalls (online, created_at desc);
