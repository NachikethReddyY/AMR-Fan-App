CREATE TABLE app.fan_submission_contributions (
  points_operation_id uuid PRIMARY KEY REFERENCES app.points_operations(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  submission_id uuid NOT NULL REFERENCES app.fan_submissions(id) ON DELETE RESTRICT,
  points integer NOT NULL CHECK (points >= 10)
);
CREATE INDEX submission_contribution_totals ON app.fan_submission_contributions(submission_id);

CREATE TABLE app.fan_submission_admin_actions (
  id uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES app.principals(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('create', 'close', 'release', 'fulfil')),
  fingerprint text NOT NULL CHECK (length(fingerprint) = 64),
  outcome jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (actor_id, request_id)
);
CREATE TABLE app.fan_interaction_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  created_by uuid NOT NULL REFERENCES app.principals(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_action_id uuid NOT NULL UNIQUE REFERENCES app.fan_submission_admin_actions(id) DEFERRABLE INITIALLY DEFERRED,
  closed_by uuid REFERENCES app.principals(id) ON DELETE RESTRICT,
  closed_at timestamptz,
  closed_action_id uuid UNIQUE REFERENCES app.fan_submission_admin_actions(id) DEFERRABLE INITIALLY DEFERRED,
  CHECK ((closed_by IS NULL AND closed_at IS NULL AND closed_action_id IS NULL)
    OR (closed_by IS NOT NULL AND closed_at IS NOT NULL AND closed_action_id IS NOT NULL))
);
CREATE TABLE app.fan_submission_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES app.fan_interaction_sessions(id) ON DELETE RESTRICT,
  submission_id uuid NOT NULL REFERENCES app.fan_submissions(id) ON DELETE RESTRICT,
  rank smallint NOT NULL CHECK (rank BETWEEN 1 AND 3),
  ranking_points numeric NOT NULL CHECK (ranking_points > 0 AND ranking_points = trunc(ranking_points)),
  approved_at timestamptz NOT NULL,
  selected_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  status text NOT NULL DEFAULT 'selected' CHECK (status IN ('selected', 'released', 'fulfilled')),
  resolved_by uuid REFERENCES app.principals(id) ON DELETE RESTRICT,
  resolved_at timestamptz,
  reason text,
  resolved_action_id uuid UNIQUE REFERENCES app.fan_submission_admin_actions(id) DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (session_id, rank),
  UNIQUE (session_id, submission_id),
  CHECK ((status = 'selected' AND resolved_by IS NULL AND resolved_at IS NULL AND reason IS NULL AND resolved_action_id IS NULL)
    OR (status <> 'selected' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL
      AND reason IS NOT NULL AND length(btrim(reason)) BETWEEN 1 AND 500 AND resolved_action_id IS NOT NULL))
);
CREATE UNIQUE INDEX submission_current_selection ON app.fan_submission_selections(submission_id)
  WHERE status IN ('selected', 'fulfilled');

CREATE FUNCTION app.protect_participation_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Participation history is retained.' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER immutable_contribution_rows BEFORE UPDATE OR DELETE ON app.fan_submission_contributions
  FOR EACH ROW EXECUTE FUNCTION app.protect_participation_history();
CREATE TRIGGER immutable_contribution_truncate BEFORE TRUNCATE ON app.fan_submission_contributions
  FOR EACH STATEMENT EXECUTE FUNCTION app.protect_participation_history();
CREATE TRIGGER immutable_participation_actions BEFORE UPDATE OR DELETE ON app.fan_submission_admin_actions
  FOR EACH ROW EXECUTE FUNCTION app.protect_participation_history();
CREATE TRIGGER immutable_participation_actions_truncate BEFORE TRUNCATE ON app.fan_submission_admin_actions
  FOR EACH STATEMENT EXECUTE FUNCTION app.protect_participation_history();
CREATE TRIGGER retained_session_rows BEFORE DELETE ON app.fan_interaction_sessions
  FOR EACH ROW EXECUTE FUNCTION app.protect_participation_history();
CREATE TRIGGER retained_session_truncate BEFORE TRUNCATE ON app.fan_interaction_sessions
  FOR EACH STATEMENT EXECUTE FUNCTION app.protect_participation_history();
CREATE TRIGGER retained_selection_rows BEFORE DELETE ON app.fan_submission_selections
  FOR EACH ROW EXECUTE FUNCTION app.protect_participation_history();
CREATE TRIGGER retained_selection_truncate BEFORE TRUNCATE ON app.fan_submission_selections
  FOR EACH STATEMENT EXECUTE FUNCTION app.protect_participation_history();

CREATE FUNCTION app.close_interaction_once() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.closed_at IS NOT NULL OR NEW.closed_at IS NULL OR
    ROW(NEW.id, NEW.sequence, NEW.created_by, NEW.created_at, NEW.created_action_id)
    IS DISTINCT FROM ROW(OLD.id, OLD.sequence, OLD.created_by, OLD.created_at, OLD.created_action_id) THEN
    RAISE EXCEPTION 'Only an open session can close once.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER close_interaction_once BEFORE UPDATE ON app.fan_interaction_sessions
  FOR EACH ROW EXECUTE FUNCTION app.close_interaction_once();
CREATE FUNCTION app.resolve_selection_once() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'selected' OR NEW.status NOT IN ('released', 'fulfilled') OR
    ROW(NEW.id, NEW.session_id, NEW.submission_id, NEW.rank, NEW.ranking_points, NEW.approved_at, NEW.selected_at)
    IS DISTINCT FROM ROW(OLD.id, OLD.session_id, OLD.submission_id, OLD.rank, OLD.ranking_points, OLD.approved_at, OLD.selected_at) THEN
    RAISE EXCEPTION 'Only an unresolved selection can resolve once.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER resolve_selection_once BEFORE UPDATE ON app.fan_submission_selections
  FOR EACH ROW EXECUTE FUNCTION app.resolve_selection_once();
