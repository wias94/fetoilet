alter table stalls add column if not exists location_id text;
alter table user_state add column if not exists location_id text;
create unique index if not exists stalls_location_id_idx on stalls (location_id) where location_id is not null;
create unique index if not exists user_state_location_id_idx on user_state (location_id) where location_id is not null;
