create table if not exists posts (
  id          text primary key,
  stall_id    text not null,
  user_id     text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists posts_created_idx on posts (created_at desc);
create index if not exists posts_stall_idx on posts (stall_id, created_at desc);

create table if not exists conversations (
  id              text primary key,
  stall_id        text not null,
  seeker_id       text not null,
  last_body       text not null default '',
  last_at         timestamptz not null default now(),
  unread_seeker   int not null default 0,
  unread_stall    int not null default 0,
  unique (stall_id, seeker_id)
);

create index if not exists conversations_seeker_idx on conversations (seeker_id, last_at desc);
create index if not exists conversations_stall_idx on conversations (stall_id, last_at desc);

create table if not exists messages (
  id               text primary key,
  conversation_id  text not null,
  sender_id        text not null,
  body             text not null,
  created_at       timestamptz not null default now()
);

create index if not exists messages_convo_idx on messages (conversation_id, created_at);
