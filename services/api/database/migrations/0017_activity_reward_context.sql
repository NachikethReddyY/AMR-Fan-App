ALTER TABLE app.activity_reward_claims ALTER COLUMN operation_id SET NOT NULL;

DROP TRIGGER immutable_activity_images ON app.activity_credited_images;
ALTER TABLE app.activity_credited_images
  ADD COLUMN source_context text NOT NULL DEFAULT 'production'
    CHECK (source_context IN ('production','synthetic_test'));
UPDATE app.activity_credited_images i
SET source_context = c.source_context
FROM app.activity_reward_claims c
WHERE c.assessment_id = i.assessment_id;
ALTER TABLE app.activity_credited_images ALTER COLUMN source_context DROP DEFAULT;
ALTER TABLE app.activity_credited_images DROP CONSTRAINT activity_credited_images_pkey;
ALTER TABLE app.activity_credited_images
  ADD CONSTRAINT activity_credited_images_pkey PRIMARY KEY (image_hash, source_context);
CREATE TRIGGER immutable_activity_images BEFORE UPDATE OR DELETE ON app.activity_credited_images
  FOR EACH ROW EXECUTE FUNCTION app.protect_activity_rewards();
