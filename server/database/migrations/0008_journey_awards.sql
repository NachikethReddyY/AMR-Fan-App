-- Domain receipts only. app.points_operations remains the single balance/History ledger.
CREATE TABLE app.journey_award_assessments (
  id uuid PRIMARY KEY,
  journey_id uuid NOT NULL REFERENCES app.journeys(id) ON DELETE RESTRICT,
  profile_id uuid NOT NULL REFERENCES app.profiles(id) ON DELETE RESTRICT,
  assessment_version text NOT NULL,
  assessment_revision integer NOT NULL CHECK (assessment_revision >= 0),
  operation_id uuid NOT NULL UNIQUE REFERENCES app.points_operations(id)
    DEFERRABLE INITIALLY DEFERRED,
  receipt jsonb NOT NULL CHECK (jsonb_typeof(receipt) = 'object'),
  UNIQUE (journey_id, assessment_version, assessment_revision),
  UNIQUE (id, journey_id, profile_id)
);
CREATE TABLE app.journey_award_state (
  journey_id uuid PRIMARY KEY REFERENCES app.journeys(id) ON DELETE RESTRICT,
  profile_id uuid NOT NULL REFERENCES app.profiles(id) ON DELETE RESTRICT,
  cumulative_automatic_credit integer NOT NULL CHECK (cumulative_automatic_credit BETWEEN 0 AND 2000),
  latest_receipt_id uuid NOT NULL,
  FOREIGN KEY (latest_receipt_id, journey_id, profile_id)
    REFERENCES app.journey_award_assessments(id, journey_id, profile_id)
);
CREATE INDEX journey_award_owner ON app.journey_award_state(profile_id, journey_id);
CREATE TRIGGER immutable_award_receipts BEFORE UPDATE OR DELETE ON app.journey_award_assessments
  FOR EACH ROW EXECUTE FUNCTION app.protect_points_history();
CREATE TRIGGER immutable_award_receipt_truncate BEFORE TRUNCATE ON app.journey_award_assessments
  FOR EACH STATEMENT EXECUTE FUNCTION app.protect_points_history();

CREATE FUNCTION app.protect_journey_award_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'Automatic journey credit state cannot be removed';
  END IF;
  IF NEW.journey_id IS DISTINCT FROM OLD.journey_id
     OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
     OR NEW.cumulative_automatic_credit < OLD.cumulative_automatic_credit THEN
    RAISE EXCEPTION 'Automatic journey credit identity and cumulative credit are retained';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER retained_award_state BEFORE UPDATE OR DELETE ON app.journey_award_state
  FOR EACH ROW EXECUTE FUNCTION app.protect_journey_award_state();
CREATE TRIGGER retained_award_state_truncate BEFORE TRUNCATE ON app.journey_award_state
  FOR EACH STATEMENT EXECUTE FUNCTION app.protect_points_history();
