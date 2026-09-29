CREATE TABLE app.reward_offers (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('tree', 'content', 'discount')),
  current_version integer NOT NULL CHECK (current_version > 0)
);

-- Each edit appends a version, including disablement. Purchased content stays here.
CREATE TABLE app.reward_offer_versions (
  offer_id uuid NOT NULL REFERENCES app.reward_offers(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  enabled boolean NOT NULL,
  product jsonb NOT NULL CHECK (jsonb_typeof(product) = 'object'),
  actor_id uuid NOT NULL REFERENCES app.principals(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  fingerprint text NOT NULL CHECK (length(fingerprint) = 64),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (offer_id, version),
  UNIQUE (actor_id, request_id)
);
ALTER TABLE app.reward_offers ADD CONSTRAINT reward_current_version
  FOREIGN KEY (id, current_version) REFERENCES app.reward_offer_versions(offer_id, version)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE app.reward_receipts (
  id uuid PRIMARY KEY REFERENCES app.points_operations(id) DEFERRABLE INITIALLY DEFERRED,
  profile_id uuid NOT NULL REFERENCES app.profiles(id) ON DELETE RESTRICT,
  offer_id uuid NOT NULL,
  offer_version integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('tree', 'content', 'discount')),
  receipt jsonb NOT NULL CHECK (jsonb_typeof(receipt) = 'object'),
  FOREIGN KEY (offer_id, offer_version) REFERENCES app.reward_offer_versions(offer_id, version)
);
CREATE INDEX reward_receipts_profile ON app.reward_receipts(profile_id, id);
CREATE UNIQUE INDEX reward_content_once ON app.reward_receipts(profile_id, offer_id)
  WHERE kind = 'content';

CREATE FUNCTION app.protect_reward_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Reward versions and receipts are retained.' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER immutable_reward_versions BEFORE UPDATE OR DELETE ON app.reward_offer_versions
  FOR EACH ROW EXECUTE FUNCTION app.protect_reward_record();
CREATE TRIGGER immutable_reward_versions_truncate BEFORE TRUNCATE ON app.reward_offer_versions
  FOR EACH STATEMENT EXECUTE FUNCTION app.protect_reward_record();
CREATE TRIGGER immutable_reward_receipts BEFORE UPDATE OR DELETE ON app.reward_receipts
  FOR EACH ROW EXECUTE FUNCTION app.protect_reward_record();
CREATE TRIGGER immutable_reward_receipts_truncate BEFORE TRUNCATE ON app.reward_receipts
  FOR EACH STATEMENT EXECUTE FUNCTION app.protect_reward_record();
