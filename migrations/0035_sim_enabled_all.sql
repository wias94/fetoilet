alter table behavior_male alter column sim_enabled set default true;
alter table behavior_stall alter column sim_enabled set default true;

insert into behavior_male (user_id)
select s.user_id
from user_state s
where coalesce(s.role, 'male') = 'male'
  and coalesce(s.banned, false) = false
on conflict (user_id) do nothing;

update behavior_male
set sim_enabled = true, updated_at = now()
where sim_enabled = false;

update behavior_stall
set sim_enabled = true, updated_at = now()
where sim_enabled = false;

-- 男人没坐标时抄名下货的点，不写死城市。
update user_state u
set lat = s.lat,
    lng = s.lng,
    loc_source = coalesce(u.loc_source, 'gps'),
    loc_updated_at = coalesce(u.loc_updated_at, now()),
    updated_at = now()
from (
  select distinct on (owner_id) owner_id, lat, lng
  from stalls
  where owner_id is not null
    and lat is not null
    and lng is not null
  order by owner_id, updated_at desc nulls last
) s
where u.user_id = s.owner_id
  and (u.lat is null or u.lng is null);
