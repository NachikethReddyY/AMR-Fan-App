CREATE TABLE app.principals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer text NOT NULL CHECK (length(issuer) BETWEEN 1 AND 2048),
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 255),
  role text NOT NULL DEFAULT 'fan' CHECK (role IN ('fan', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issuer, subject)
);

CREATE TABLE app.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id uuid NOT NULL REFERENCES app.principals(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('real', 'demo')),
  display_name text NOT NULL DEFAULT 'Fan' CHECK (length(display_name) BETWEEN 1 AND 80),
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (principal_id, kind)
);

CREATE TABLE app.sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  principal_id uuid NOT NULL REFERENCES app.principals(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_principal ON app.sessions(principal_id);

CREATE TABLE app.role_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  principal_id uuid NOT NULL REFERENCES app.principals(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('fan', 'admin')),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  assigned_at timestamptz NOT NULL DEFAULT now()
);
