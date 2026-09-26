CREATE TABLE app.report_documents (
  id uuid PRIMARY KEY,
  uploader_id uuid NOT NULL REFERENCES app.principals(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  source_kind text NOT NULL CHECK (source_kind IN ('synthetic', 'permitted')),
  sha256 text CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  byte_count integer CHECK (byte_count BETWEEN 1 AND 10485760),
  parser_version text,
  status text NOT NULL DEFAULT 'awaiting-upload' CHECK (status IN ('awaiting-upload', 'review', 'failed')),
  failure text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (uploader_id, request_id),
  CHECK ((sha256 IS NULL) = (byte_count IS NULL))
);
CREATE TABLE app.report_pages (
  document_id uuid NOT NULL REFERENCES app.report_documents(id) ON DELETE RESTRICT,
  page integer NOT NULL CHECK (page BETWEEN 1 AND 100),
  parser_version text NOT NULL,
  text text NOT NULL CHECK (length(text) <= 1000000),
  PRIMARY KEY(document_id, page)
);
CREATE TABLE app.report_extractions (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES app.report_documents(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES app.principals(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  fingerprint text NOT NULL,
  pages integer[] NOT NULL,
  status text NOT NULL CHECK (status IN ('review', 'unavailable')),
  metadata jsonb,
  failure text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(actor_id, request_id)
);
CREATE TABLE app.report_candidates (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES app.report_documents(id) ON DELETE RESTRICT,
  extraction_id uuid REFERENCES app.report_extractions(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES app.principals(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(actor_id, request_id)
);
CREATE TABLE app.report_revisions (
  id uuid PRIMARY KEY,
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  candidate_id uuid NOT NULL REFERENCES app.report_candidates(id) ON DELETE RESTRICT,
  previous_id uuid REFERENCES app.report_revisions(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES app.principals(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  fingerprint text NOT NULL,
  fields jsonb NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(actor_id, request_id),
  UNIQUE(previous_id)
);
CREATE INDEX report_revision_latest ON app.report_revisions(candidate_id, sequence DESC);
CREATE TABLE app.report_decisions (
  id uuid PRIMARY KEY,
  candidate_id uuid NOT NULL REFERENCES app.report_candidates(id) ON DELETE RESTRICT,
  revision_id uuid NOT NULL UNIQUE REFERENCES app.report_revisions(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES app.principals(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  fingerprint text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('approved', 'rejected')),
  replaces_id uuid UNIQUE REFERENCES app.report_decisions(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(actor_id, request_id),
  CHECK (kind = 'approved' OR replaces_id IS NULL)
);
CREATE INDEX report_decision_candidate ON app.report_decisions(candidate_id);

CREATE FUNCTION app.protect_report_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Report evidence is immutable; append a revision or decision.' USING ERRCODE = '23514';
END;
$$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['report_pages', 'report_extractions', 'report_candidates', 'report_revisions', 'report_decisions'] LOOP
    EXECUTE format('CREATE TRIGGER immutable_report_rows BEFORE UPDATE OR DELETE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.protect_report_evidence()', t);
    EXECUTE format('CREATE TRIGGER immutable_report_truncate BEFORE TRUNCATE ON app.%I FOR EACH STATEMENT EXECUTE FUNCTION app.protect_report_evidence()', t);
  END LOOP;
END $$;
CREATE FUNCTION app.protect_report_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.id <> OLD.id OR NEW.uploader_id <> OLD.uploader_id OR
    NEW.request_id <> OLD.request_id OR NEW.title <> OLD.title OR NEW.source_kind <> OLD.source_kind OR NEW.created_at <> OLD.created_at OR
    (OLD.sha256 IS NOT NULL AND (NEW.sha256 IS DISTINCT FROM OLD.sha256 OR NEW.byte_count IS DISTINCT FROM OLD.byte_count)) OR
    (OLD.parser_version IS NOT NULL AND NEW.parser_version IS DISTINCT FROM OLD.parser_version) THEN
    RAISE EXCEPTION 'Report source is immutable.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER immutable_report_source BEFORE UPDATE OR DELETE ON app.report_documents FOR EACH ROW EXECUTE FUNCTION app.protect_report_source();
CREATE TRIGGER immutable_report_documents_truncate BEFORE TRUNCATE ON app.report_documents FOR EACH STATEMENT EXECUTE FUNCTION app.protect_report_evidence();
