-- Gate 1 evidence only. This table never writes points or mission progress.
CREATE TABLE app.activity_assessments (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES app.profiles(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  payload_digest text NOT NULL CHECK (payload_digest ~ '^[0-9a-f]{64}$'),
  mission_id uuid,
  status text NOT NULL CHECK (status IN ('processing', 'accepted', 'uncertain', 'rejected', 'unavailable')),
  image_hashes jsonb NOT NULL CHECK (jsonb_typeof(image_hashes) = 'array'),
  result jsonb NOT NULL,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  UNIQUE (profile_id, request_id),
  CHECK ((status = 'processing' AND completed_at IS NULL)
    OR (status <> 'processing' AND completed_at IS NOT NULL))
);
CREATE INDEX activity_assessment_owner ON app.activity_assessments(profile_id, started_at DESC);
REVOKE ALL ON app.activity_assessments FROM PUBLIC;
