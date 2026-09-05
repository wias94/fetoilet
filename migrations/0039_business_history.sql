-- Durable business history. Deliberately excludes authentication/session tables.
CREATE TABLE history_changes (
  id bigserial PRIMARY KEY,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  source text NOT NULL,
  operation text NOT NULL,
  entity_id text,
  before_data jsonb,
  after_data jsonb
);
CREATE INDEX history_changes_entity_idx ON history_changes (source, entity_id, recorded_at);
CREATE INDEX history_changes_time_idx ON history_changes (recorded_at);
CREATE TABLE history_daily (
  day date NOT NULL,
  source text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  data jsonb NOT NULL,
  PRIMARY KEY (day, source)
);
CREATE FUNCTION capture_business_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous jsonb; current_row jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN previous := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN current_row := to_jsonb(NEW); END IF;
  IF previous IS NOT DISTINCT FROM current_row THEN RETURN NULL; END IF;
  INSERT INTO history_changes(source, operation, entity_id, before_data, after_data)
  VALUES (TG_TABLE_NAME, TG_OP,
    coalesce(current_row->>'id', previous->>'id', current_row->>'user_id', previous->>'user_id',
             current_row->>'person_id', previous->>'person_id', current_row->>'stall_id', previous->>'stall_id'),
    previous, current_row);
  RETURN NULL;
END $$;
CREATE TRIGGER business_history AFTER INSERT OR UPDATE OR DELETE ON "user" FOR EACH ROW EXECUTE FUNCTION capture_business_history();
CREATE TRIGGER business_history AFTER INSERT OR UPDATE OR DELETE ON "stalls" FOR EACH ROW EXECUTE FUNCTION capture_business_history();
CREATE TRIGGER business_history AFTER INSERT OR UPDATE OR DELETE ON "user_state" FOR EACH ROW EXECUTE FUNCTION capture_business_history();
CREATE TRIGGER business_history AFTER INSERT OR UPDATE OR DELETE ON "behavior_person" FOR EACH ROW EXECUTE FUNCTION capture_business_history();
CREATE TRIGGER business_history AFTER INSERT OR UPDATE OR DELETE ON "behavior_male" FOR EACH ROW EXECUTE FUNCTION capture_business_history();
CREATE TRIGGER business_history AFTER INSERT OR UPDATE OR DELETE ON "behavior_stall" FOR EACH ROW EXECUTE FUNCTION capture_business_history();
CREATE TRIGGER business_history AFTER INSERT OR UPDATE OR DELETE ON "behavior_econ" FOR EACH ROW EXECUTE FUNCTION capture_business_history();
CREATE TRIGGER business_history AFTER INSERT OR UPDATE OR DELETE ON "behavior_satiation" FOR EACH ROW EXECUTE FUNCTION capture_business_history();
CREATE TRIGGER business_history AFTER INSERT OR UPDATE OR DELETE ON "orders" FOR EACH ROW EXECUTE FUNCTION capture_business_history();
CREATE TRIGGER business_history AFTER INSERT OR UPDATE OR DELETE ON "ledger" FOR EACH ROW EXECUTE FUNCTION capture_business_history();
CREATE TRIGGER business_history AFTER INSERT OR UPDATE OR DELETE ON "wallets" FOR EACH ROW EXECUTE FUNCTION capture_business_history();
CREATE TRIGGER business_history AFTER INSERT OR UPDATE OR DELETE ON "events" FOR EACH ROW EXECUTE FUNCTION capture_business_history();
CREATE TRIGGER business_history AFTER INSERT OR UPDATE OR DELETE ON "sim_runs" FOR EACH ROW EXECUTE FUNCTION capture_business_history();
CREATE TRIGGER business_history AFTER INSERT OR UPDATE OR DELETE ON "sim_log" FOR EACH ROW EXECUTE FUNCTION capture_business_history();

-- One snapshot per Toronto calendar day, taken on the first successful poll.
CREATE FUNCTION archive_business_day() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE source_name text; archive_day date; written integer := 0; affected integer;
BEGIN
  PERFORM pg_advisory_xact_lock(739039);
  archive_day := (now() AT TIME ZONE 'America/Toronto')::date;
  FOREACH source_name IN ARRAY ARRAY['user','stalls','user_state','behavior_person','behavior_male','behavior_stall','behavior_econ','behavior_satiation','wallets'] LOOP
    IF NOT EXISTS (SELECT 1 FROM history_daily WHERE day=archive_day AND source=source_name) THEN
      EXECUTE format('INSERT INTO history_daily(day,source,data) SELECT $1,$2,coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM %I t ON CONFLICT DO NOTHING', source_name)
        USING archive_day, source_name;
      GET DIAGNOSTICS affected = ROW_COUNT;
      written := written + affected;
    END IF;
  END LOOP;
  RETURN written;
END $$;
SELECT archive_business_day();
