create table if not exists user_state (
  user_id        text primary key,
  banned         boolean not null default false,
  ban_reason     text not null default '',
  last_seen_at   timestamptz,
  lat            double precision,
  lng            double precision,
  accuracy_m     double precision,
  heading        double precision,
  speed_mps      double precision,
  loc_source     text,
  loc_updated_at timestamptz,
  updated_at     timestamptz not null default now()
);

create table if not exists events (
  id          text primary key,
  user_id     text not null,
  kind        text not null,
  target_id   text,
  payload     jsonb not null default '{}'::jsonb,
  lat         double precision,
  lng         double precision,
  created_at  timestamptz not null default now()
);

create index if not exists events_user_idx on events (user_id, created_at desc);
create index if not exists events_kind_idx on events (kind, created_at desc);
create index if not exists user_state_loc_idx on user_state (lat, lng) where lat is not null;

alter table stalls add column if not exists lat double precision;
alter table stalls add column if not exists lng double precision;
