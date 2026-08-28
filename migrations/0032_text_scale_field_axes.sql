delete from text_scale where field = 'persona' and axis = 'obedient';
update text_scale set axis = field where axis is distinct from field;
delete from text_scale where axis in ('lewd', 'chest', 'obedient', 'bare');
