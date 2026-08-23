alter table stalls add column if not exists stall_token text;
alter table stalls add column if not exists listed_fen integer;
alter table stalls add column if not exists relation text;

create unique index if not exists stalls_stall_token_idx on stalls (stall_token) where stall_token is not null;

create table if not exists wallets (
  user_id text primary key,
  fen     integer not null default 0
);

create table if not exists ledger (
  id          text primary key,
  user_id     text not null,
  fen         integer not null,
  kind        text not null,
  ref_id      text,
  note        text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists ledger_user_idx on ledger (user_id, created_at desc);

create table if not exists claim_requests (
  id          text primary key,
  stall_id    text not null,
  male_id     text not null,
  inquiry_id  text,
  status      text not null default 'pending',
  created_at  timestamptz not null default now()
);

create index if not exists claim_requests_male_idx on claim_requests (male_id, status);
