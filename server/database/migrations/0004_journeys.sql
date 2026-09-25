CREATE TABLE app.journeys (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES app.profiles(id) ON DELETE CASCADE,
  summary jsonb NOT NULL CHECK (jsonb_typeof(summary) = 'object'),
  snapshot jsonb CHECK (snapshot IS NULL OR jsonb_typeof(snapshot) = 'object'),
  precise_expires_at timestamptz NOT NULL
);
CREATE INDEX journeys_owner ON app.journeys(profile_id, id);
CREATE INDEX journeys_expiry ON app.journeys(precise_expires_at) WHERE snapshot IS NOT NULL;

CREATE TABLE app.journey_requests (
  principal_id uuid NOT NULL REFERENCES app.principals(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  journey_id uuid NOT NULL REFERENCES app.journeys(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  result jsonb NOT NULL,
  PRIMARY KEY (principal_id, request_id)
);

CREATE TABLE app.journey_samples (
  journey_id uuid NOT NULL REFERENCES app.journeys(id) ON DELETE CASCADE,
  sample_id uuid NOT NULL,
  acquired_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  sample jsonb NOT NULL CHECK (jsonb_typeof(sample) = 'object'),
  PRIMARY KEY (journey_id, sample_id),
  CHECK (expires_at = acquired_at + interval '7 days')
);
CREATE INDEX journey_samples_expiry ON app.journey_samples(expires_at);

CREATE FUNCTION app.protect_journey_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
     OR NEW.precise_expires_at IS DISTINCT FROM OLD.precise_expires_at
     OR (NEW.snapshot IS DISTINCT FROM OLD.snapshot AND NEW.snapshot IS NOT NULL) THEN
    RAISE EXCEPTION 'Journey identity and snapshot are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER immutable_journey_snapshot BEFORE UPDATE ON app.journeys
FOR EACH ROW EXECUTE FUNCTION app.protect_journey_snapshot();

CREATE FUNCTION app.protect_journey_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Journey evidence and successful request receipts are append-only';
END;
$$;
CREATE TRIGGER immutable_journey_sample BEFORE UPDATE ON app.journey_samples
FOR EACH ROW EXECUTE FUNCTION app.protect_journey_evidence();
CREATE TRIGGER immutable_journey_request BEFORE UPDATE ON app.journey_requests
FOR EACH ROW EXECUTE FUNCTION app.protect_journey_evidence();

-- No coordinates or query text in durable plan receipts. Precise candidates live
-- exclusively in expiring journey snapshots; replay never reacquires them.
CREATE TABLE app.journey_plans (
  principal_id uuid NOT NULL REFERENCES app.principals(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES app.profiles(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  result jsonb NOT NULL,
  PRIMARY KEY (principal_id, request_id)
);
CREATE TRIGGER immutable_journey_plan BEFORE UPDATE ON app.journey_plans
FOR EACH ROW EXECUTE FUNCTION app.protect_journey_evidence();
