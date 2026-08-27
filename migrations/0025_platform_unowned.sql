insert into "user" (id, name, email, "emailVerified")
values ('platform', '巷厕平台', 'platform@xiangce.app', true)
on conflict (id) do nothing;

insert into wallets (user_id, fen) values ('platform', 0)
on conflict (user_id) do nothing;

update stalls
set owner_id = 'platform',
    listed_fen = 1000,
    hour_fen = 200,
    owned_at = coalesce(owned_at, now()),
    updated_at = now()
where owner_id is null;
