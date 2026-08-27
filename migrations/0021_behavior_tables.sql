alter table user_state add column if not exists age integer;

create table if not exists behavior_person (
  person_id text primary key,
  sociability real not null default 0.5,
  routine_preference real not null default 0.5,
  spontaneity real not null default 0.5,
  travel_tolerance real not null default 0.5,
  nightlife_preference real not null default 0.5,
  activity_budget real not null default 0.5,
  family_orientation real not null default 0.5,
  warmth real not null default 0.5,
  directness real not null default 0.5,
  patience real not null default 0.5,
  communication_style text not null default '',
  personality_summary text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists behavior_male (
  user_id text primary key references "user"(id) on delete cascade,
  person_id text,
  job text not null default '',
  family_status text not null default '',
  taste jsonb not null default '{}'::jsonb,
  session_style text not null default '快餐灌注',
  condom_pref text not null default '看货',
  objectify real not null default 0.6,
  novelty real not null default 0.4,
  risk real not null default 0.3,
  budget_band text not null default '中',
  sim_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists behavior_stall (
  stall_id text primary key references stalls(id) on delete cascade,
  person_id text,
  sim_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into behavior_person (
  person_id, sociability, routine_preference, spontaneity, travel_tolerance,
  nightlife_preference, activity_budget, family_orientation, warmth, directness, patience,
  communication_style, personality_summary
)
select person_id, sociability, routine_preference, spontaneity, travel_tolerance,
  nightlife_preference, activity_budget, family_orientation, warmth, directness, patience,
  communication_style, personality_summary
from male_profiles
where person_id is not null
on conflict (person_id) do nothing;

insert into behavior_male (
  user_id, person_id, job, family_status, taste, session_style, condom_pref,
  objectify, novelty, risk, budget_band, sim_enabled
)
select user_id, person_id, job, family_status, taste, session_style, condom_pref,
  objectify, novelty, risk, budget_band, sim_enabled
from male_profiles
on conflict (user_id) do nothing;

insert into behavior_stall (stall_id, person_id, sim_enabled)
select id, person_id, true
from stalls
where person_id is not null
on conflict (stall_id) do nothing;

update user_state u
set age = m.age
from male_profiles m
where m.user_id = u.user_id and m.age is not null and u.age is null;

update user_state u
set age = s.age
from stalls s
where s.user_id = u.user_id and u.age is null;

drop table if exists male_profiles;
