CREATE TABLE app.activity_reward_claims (
  assessment_id uuid PRIMARY KEY REFERENCES app.activity_assessments(id) ON DELETE RESTRICT,
  operation_id uuid NOT NULL UNIQUE REFERENCES app.points_operations(id) DEFERRABLE INITIALLY DEFERRED,
  profile_id uuid NOT NULL REFERENCES app.profiles(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  payload_digest text NOT NULL CHECK (payload_digest ~ '^[0-9a-f]{64}$'),
  image_hashes jsonb NOT NULL CHECK (jsonb_typeof(image_hashes) = 'array'),
  source_context text NOT NULL CHECK (source_context IN ('production','synthetic_test')),
  credited_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (profile_id, request_id)
);
CREATE INDEX activity_reward_daily ON app.activity_reward_claims(profile_id, credited_at);
CREATE TABLE app.activity_credited_images (
  image_hash text PRIMARY KEY CHECK (image_hash ~ '^[0-9a-f]{64}$'),
  assessment_id uuid NOT NULL REFERENCES app.activity_reward_claims(assessment_id) ON DELETE RESTRICT
);
CREATE INDEX activity_claim_images_assessment ON app.activity_credited_images(assessment_id);

CREATE TABLE app.mission_definitions (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 120),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  category text NOT NULL CHECK (length(category) BETWEEN 1 AND 80),
  source_label text NOT NULL CHECK (length(source_label) BETWEEN 1 AND 200),
  kind text NOT NULL CHECK (kind IN ('personal','race_week')),
  target integer NOT NULL CHECK (target > 0),
  community_target integer CHECK (community_target IS NULL OR community_target > 0),
  policy_version text NOT NULL CHECK (length(policy_version) BETWEEN 1 AND 80),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL CHECK (length(timezone) BETWEEN 1 AND 100),
  status text NOT NULL CHECK (status IN ('active','archived')),
  version integer NOT NULL CHECK (version > 0),
  CHECK (ends_at > starts_at)
);
CREATE TABLE app.mission_enrollments (
  profile_id uuid NOT NULL REFERENCES app.profiles(id) ON DELETE RESTRICT,
  mission_id uuid NOT NULL REFERENCES app.mission_definitions(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  enrolled_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (profile_id, mission_id)
);
CREATE TABLE app.mission_progress (
  profile_id uuid NOT NULL REFERENCES app.profiles(id) ON DELETE RESTRICT,
  mission_id uuid NOT NULL REFERENCES app.mission_definitions(id) ON DELETE RESTRICT,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  completed_at timestamptz,
  PRIMARY KEY (profile_id, mission_id),
  FOREIGN KEY (profile_id, mission_id) REFERENCES app.mission_enrollments(profile_id, mission_id) ON DELETE RESTRICT
);
CREATE TABLE app.mission_events (
  id uuid PRIMARY KEY,
  event_key text NOT NULL UNIQUE CHECK (length(event_key) BETWEEN 1 AND 160),
  profile_id uuid NOT NULL REFERENCES app.profiles(id) ON DELETE RESTRICT,
  mission_id uuid NOT NULL REFERENCES app.mission_definitions(id) ON DELETE RESTRICT,
  assessment_id uuid NOT NULL REFERENCES app.activity_assessments(id) ON DELETE RESTRICT,
  delta integer NOT NULL CHECK (delta > 0),
  source_context text NOT NULL CHECK (source_context IN ('production','synthetic_test')),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX mission_event_assessment ON app.mission_events(assessment_id, mission_id);
CREATE INDEX mission_events_community ON app.mission_events(mission_id, recorded_at)
  WHERE source_context = 'production';
CREATE FUNCTION app.protect_activity_rewards() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Activity rewards and mission history are immutable.' USING ERRCODE = '23514'; END;
$$;
CREATE TRIGGER immutable_activity_claims BEFORE UPDATE OR DELETE ON app.activity_reward_claims FOR EACH ROW EXECUTE FUNCTION app.protect_activity_rewards();
CREATE TRIGGER immutable_activity_claims_truncate BEFORE TRUNCATE ON app.activity_reward_claims FOR EACH STATEMENT EXECUTE FUNCTION app.protect_activity_rewards();
CREATE TRIGGER immutable_activity_images BEFORE UPDATE OR DELETE ON app.activity_credited_images FOR EACH ROW EXECUTE FUNCTION app.protect_activity_rewards();
CREATE TRIGGER immutable_mission_events BEFORE UPDATE OR DELETE ON app.mission_events FOR EACH ROW EXECUTE FUNCTION app.protect_activity_rewards();
CREATE TRIGGER immutable_mission_events_truncate BEFORE TRUNCATE ON app.mission_events FOR EACH STATEMENT EXECUTE FUNCTION app.protect_activity_rewards();

INSERT INTO app.mission_definitions
  (id, slug, title, category, source_label, kind, target, community_target, policy_version, starts_at, ends_at, timezone, status, version)
VALUES
  ('4d7b7ad7-0f6f-4b98-9876-5e3c4e90d001', 'refill-and-reuse', 'Refill and reuse', 'reuse_refill', 'AMR fan app challenge - independently curated', 'personal', 1, NULL, 'activity-reward-v1', '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', 'UTC', 'active', 1),
  ('4d7b7ad7-0f6f-4b98-9876-5e3c4e90d002', 'pick-up-litter', 'Pick up litter', 'cleanup', 'AMR fan app challenge - independently curated', 'personal', 1, NULL, 'activity-reward-v1', '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', 'UTC', 'active', 1),
  ('4d7b7ad7-0f6f-4b98-9876-5e3c4e90d003', 'singapore-race-week-refill', 'Singapore race-week refill goal', 'reuse_refill', 'AMR fan app challenge - independently curated', 'race_week', 1, 100, 'activity-reward-v1', '2026-10-05T00:00:00+08:00', '2026-10-12T00:00:00+08:00', 'Asia/Singapore', 'active', 1)
ON CONFLICT (id) DO NOTHING;
