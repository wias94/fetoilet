create table if not exists male_profiles (
  user_id text primary key references "user"(id) on delete cascade,
  person_id text,
  age integer,
  job text not null default '',
  family_status text not null default '',
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
  taste jsonb not null default '{}'::jsonb,
  session_style text not null default '快餐灌注',
  condom_pref text not null default '看货',
  objectify real not null default 0.6,
  novelty real not null default 0.4,
  risk real not null default 0.3,
  budget_band text not null default '中',
  sim_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists male_profiles_person_uidx
  on male_profiles (person_id) where person_id is not null;
