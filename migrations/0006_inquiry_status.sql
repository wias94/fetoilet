alter table inquiries
  add column if not exists status text not null default 'pending';

alter table inquiries
  add column if not exists updated_at timestamptz not null default now();

create index if not exists inquiries_profile_status_idx
  on inquiries (profile_id, status, created_at desc);
