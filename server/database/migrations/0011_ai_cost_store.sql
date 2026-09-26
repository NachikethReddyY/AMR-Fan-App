-- Independent of photo migration 0010. No account, profile or points references.
CREATE TABLE app.ai_cost_budget (
  scope text PRIMARY KEY CHECK (scope = 'amr-tokenrouter-dev-and-demo'),
  cap_nano_usd bigint NOT NULL DEFAULT 10000000000 CHECK (cap_nano_usd = 10000000000),
  committed_nano_usd bigint NOT NULL DEFAULT 0 CHECK (committed_nano_usd >= 0),
  suspended boolean NOT NULL DEFAULT false
);
INSERT INTO app.ai_cost_budget(scope) VALUES ('amr-tokenrouter-dev-and-demo');

CREATE TABLE app.ai_cost_operations (
  operation_id text PRIMARY KEY CHECK (operation_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  scope text NOT NULL REFERENCES app.ai_cost_budget(scope) ON DELETE RESTRICT,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  reservation jsonb NOT NULL,
  rate_expires_at_ms bigint NOT NULL CHECK (rate_expires_at_ms > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE app.ai_cost_calls (
  operation_id text NOT NULL REFERENCES app.ai_cost_operations(operation_id) ON DELETE RESTRICT,
  call_id text NOT NULL CHECK (call_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  reserved_nano_usd bigint NOT NULL CHECK (reserved_nano_usd BETWEEN 0 AND 10000000000),
  state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved', 'started', 'held', 'reported', 'cancelled')),
  accounted_nano_usd bigint NOT NULL CHECK (accounted_nano_usd BETWEEN 0 AND reserved_nano_usd),
  bound_exceeded boolean NOT NULL DEFAULT false,
  PRIMARY KEY (operation_id, call_id),
  CHECK ((state = 'cancelled' AND accounted_nano_usd = 0 AND NOT bound_exceeded)
    OR (state IN ('reserved', 'started', 'held') AND accounted_nano_usd = reserved_nano_usd)
    OR (state = 'reported' AND NOT bound_exceeded)),
  CHECK (NOT bound_exceeded OR state = 'held')
);
-- Runtime grants are a separately reviewed deployment operation. No PUBLIC access.
REVOKE ALL ON app.ai_cost_budget, app.ai_cost_operations, app.ai_cost_calls FROM PUBLIC;
