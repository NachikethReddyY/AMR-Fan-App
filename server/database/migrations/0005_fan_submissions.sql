CREATE TABLE app.fan_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  owner_profile_id uuid NOT NULL REFERENCES app.profiles(id) ON DELETE RESTRICT,
  points_operation_id uuid NOT NULL UNIQUE REFERENCES app.points_operations(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  text text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 1600),
  tag text CHECK (tag IN ('question', 'activity', 'other')),
  fee integer NOT NULL DEFAULT 500 CHECK (fee = 500),
  resubmission_of uuid REFERENCES app.fan_submissions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX fan_submissions_owner_history ON app.fan_submissions(owner_profile_id, sequence DESC);

-- A submission has at most one terminal moderation decision. Later selection is separate.
CREATE TABLE app.fan_submission_decisions (
  submission_id uuid PRIMARY KEY REFERENCES app.fan_submissions(id) ON DELETE RESTRICT,
  admin_id uuid NOT NULL REFERENCES app.principals(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('approved', 'rejected')),
  decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (admin_id, request_id)
);

CREATE FUNCTION app.protect_submission_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Submission history is retained; resubmission is a new purchase.' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER immutable_submission_rows BEFORE UPDATE OR DELETE ON app.fan_submissions
  FOR EACH ROW EXECUTE FUNCTION app.protect_submission_history();
CREATE TRIGGER immutable_submission_truncate BEFORE TRUNCATE ON app.fan_submissions
  FOR EACH STATEMENT EXECUTE FUNCTION app.protect_submission_history();
CREATE TRIGGER immutable_submission_decisions BEFORE UPDATE OR DELETE ON app.fan_submission_decisions
  FOR EACH ROW EXECUTE FUNCTION app.protect_submission_history();
CREATE TRIGGER immutable_submission_decisions_truncate BEFORE TRUNCATE ON app.fan_submission_decisions
  FOR EACH STATEMENT EXECUTE FUNCTION app.protect_submission_history();
