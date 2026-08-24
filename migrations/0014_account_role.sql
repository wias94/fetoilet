alter table user_state add column if not exists role text;

update user_state us
set role = 'stall'
where coalesce(us.role, '') = ''
  and exists (
    select 1 from stalls s
    where s.user_id = us.user_id
      and s.user_id not like 'held:%'
      and s.user_id not like 'seed:%'
  );

update user_state us
set role = 'male'
where coalesce(us.role, '') = ''
  and (
    exists (select 1 from stalls s where s.owner_id = us.user_id)
    or exists (select 1 from inquiries i where i.user_id = us.user_id)
  );
