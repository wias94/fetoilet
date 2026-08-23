create table if not exists admins (
  email text primary key
);

insert into admins (email)
values ('wiwiiasama@gmail.com')
on conflict do nothing;

alter table stalls add column if not exists featured boolean not null default false;
alter table stalls add column if not exists hidden boolean not null default false;

create table if not exists broadcasts (
  id          text primary key,
  title       text not null,
  body        text not null,
  audience    text not null default 'all',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists broadcasts_active_idx on broadcasts (active, created_at desc);
