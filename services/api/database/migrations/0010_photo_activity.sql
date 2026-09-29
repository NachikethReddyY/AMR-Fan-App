-- No image, description, endpoints, observations or provider response is retained.
CREATE TABLE app.photo_activity_claims (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES app.profiles(id) ON DELETE RESTRICT,
  photo_hash text NOT NULL UNIQUE CHECK (photo_hash ~ '^[0-9a-f]{64}$'),
  journey_id uuid UNIQUE REFERENCES app.journeys(id) ON DELETE RESTRICT,
  operation_id uuid NOT NULL UNIQUE REFERENCES app.points_operations(id) DEFERRABLE INITIALLY DEFERRED,
  activity text NOT NULL CHECK (activity IN ('bus-trip', 'other')),
  confidence double precision NOT NULL CHECK (confidence > 0.5 AND confidence <= 1),
  credited_points integer NOT NULL CHECK (credited_points = 50),
  credit_context text NOT NULL CHECK (credit_context IN ('synthetic_test', 'live')),
  CHECK (journey_id IS NULL OR activity = 'bus-trip')
);
CREATE INDEX photo_activity_owner ON app.photo_activity_claims(profile_id, id);
CREATE TRIGGER immutable_photo_activity BEFORE UPDATE OR DELETE ON app.photo_activity_claims
  FOR EACH ROW EXECUTE FUNCTION app.protect_points_history();
CREATE TRIGGER immutable_photo_activity_truncate BEFORE TRUNCATE ON app.photo_activity_claims
  FOR EACH STATEMENT EXECUTE FUNCTION app.protect_points_history();
