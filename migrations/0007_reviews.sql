create table if not exists reviews (
  id          text primary key,
  user_id     text not null,
  profile_id  text not null,
  score       integer not null check (score >= 1 and score <= 5),
  comment     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists reviews_user_profile_idx on reviews (user_id, profile_id);
create index if not exists reviews_profile_id_idx on reviews (profile_id, created_at desc);
