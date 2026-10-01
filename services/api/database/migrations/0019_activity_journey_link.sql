ALTER TABLE app.activity_assessments
  ADD COLUMN journey_id uuid REFERENCES app.journeys(id) ON DELETE RESTRICT;
ALTER TABLE app.activity_reward_claims
  ADD COLUMN journey_id uuid REFERENCES app.journeys(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX activity_reward_claim_journey
  ON app.activity_reward_claims(journey_id)
  WHERE journey_id IS NOT NULL;
