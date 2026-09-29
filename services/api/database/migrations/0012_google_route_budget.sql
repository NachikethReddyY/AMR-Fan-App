-- Independent Google routing allowance. No AI initialization or grants.
CREATE TABLE app.google_route_budget (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  used_attempts integer NOT NULL DEFAULT 0 CHECK (used_attempts BETWEEN 0 AND 200)
);
INSERT INTO app.google_route_budget(singleton) VALUES (true);
REVOKE ALL ON app.google_route_budget FROM PUBLIC;
