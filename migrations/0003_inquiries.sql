create table if not exists inquiries (
  id            text primary key,
  user_id       text not null,
  profile_id    text not null,
  profile_name  text not null,
  slot          text not null,
  note          text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists inquiries_user_id_idx on inquiries (user_id, created_at desc);
