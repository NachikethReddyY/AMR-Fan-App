ALTER TABLE app.activity_assessments
  DROP CONSTRAINT activity_assessments_status_check;
ALTER TABLE app.activity_assessments
  ADD CONSTRAINT activity_assessments_status_check
  CHECK (status IN ('processing', 'accepted', 'uncertain', 'rejected', 'unavailable', 'cancelled', 'expired'));
