alter table behavior_male add column if not exists dims jsonb not null default '{}'::jsonb;
