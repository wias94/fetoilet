create table if not exists orders (
  id              text primary key,
  user_id         text not null,
  restaurant_id   text not null,
  restaurant_name text not null,
  items           jsonb not null,
  address         text not null,
  note            text not null default '',
  subtotal_fen    integer not null,
  delivery_fen    integer not null,
  total_fen       integer not null,
  created_at      timestamptz not null default now()
);

create index if not exists orders_user_id_idx on orders (user_id, created_at desc);
