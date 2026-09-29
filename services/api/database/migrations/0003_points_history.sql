CREATE TABLE app.points_operations (
  id uuid PRIMARY KEY,
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  actor_id uuid NOT NULL REFERENCES app.principals(id) ON DELETE RESTRICT,
  profile_id uuid NOT NULL REFERENCES app.profiles(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  kind text NOT NULL CHECK (length(kind) BETWEEN 1 AND 80),
  fingerprint text NOT NULL CHECK (length(fingerprint) = 64),
  delta integer NOT NULL,
  balance_before integer NOT NULL CHECK (balance_before >= 0),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  outcome jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT points_request UNIQUE (actor_id, request_id),
  CHECK (balance_after::bigint = balance_before::bigint + delta::bigint)
);
CREATE INDEX points_profile_history ON app.points_operations(profile_id, sequence DESC);

CREATE FUNCTION app.protect_points_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Points History is immutable; append a correction.' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER immutable_points_rows BEFORE UPDATE OR DELETE ON app.points_operations
  FOR EACH ROW EXECUTE FUNCTION app.protect_points_history();
CREATE TRIGGER immutable_points_truncate BEFORE TRUNCATE ON app.points_operations
  FOR EACH STATEMENT EXECUTE FUNCTION app.protect_points_history();
