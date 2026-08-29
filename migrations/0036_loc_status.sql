alter table user_state add column if not exists loc_status text;

create index if not exists user_state_loc_status_idx
  on user_state (loc_status)
  where loc_status is not null;
