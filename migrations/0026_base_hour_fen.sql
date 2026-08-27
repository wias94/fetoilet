alter table stalls add column if not exists base_hour_fen integer;

update stalls set base_hour_fen = hour_fen where base_hour_fen is null;

update stalls
set base_hour_fen = 200, hour_fen = 200
where owner_id = 'platform';
