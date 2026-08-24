alter table stalls add column if not exists person_id text;
alter table user_state add column if not exists person_id text;
create unique index if not exists stalls_person_uidx on stalls (person_id) where person_id is not null;
create index if not exists user_state_person_idx on user_state (person_id);
