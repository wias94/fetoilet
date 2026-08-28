create table if not exists text_scale (
  field text not null,
  option text not null,
  axis text not null,
  value real not null,
  primary key (field, option, axis)
);
