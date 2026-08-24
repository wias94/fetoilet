update stalls
set
  hour_fen = greatest(hour_fen / 10, 1),
  night_fen = greatest(night_fen / 10, 1),
  listed_fen = case when listed_fen is not null then greatest(listed_fen / 10, 1) else null end,
  deposit_fen = case when deposit_fen is not null then greatest(deposit_fen / 10, 1) else deposit_fen end;

update stalls
set extras = coalesce((
  select jsonb_agg(
    case
      when jsonb_typeof(e) = 'object' and (e ? 'fen')
        then jsonb_set(e, '{fen}', to_jsonb(greatest(coalesce((e->>'fen')::int, 0) / 10, 1)))
      else e
    end
  )
  from jsonb_array_elements(coalesce(extras, '[]'::jsonb)) e
), extras)
where extras is not null and jsonb_typeof(extras) = 'array';

update wallets set fen = fen / 10 where fen <> 0;
update ledger set fen = fen / 10 where fen <> 0;
