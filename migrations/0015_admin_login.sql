insert into admins (email) values ('admin@xiangce.local')
on conflict (email) do nothing;

delete from admins where lower(email) = 'wiwiiasama@gmail.com';
