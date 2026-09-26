import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { ApiError } from '../accounts/types.ts';
import { authenticateSession } from '../auth/session.ts';
import { transaction } from '../database/index.ts';
import {
  boundedText,
  candidateInput,
  integer,
  object,
  onlyKeys,
  requireApproval,
  uuid,
  validateCandidate,
  type Candidate,
  type Page,
} from './contracts.ts';
import { extractCandidates, type ExtractReport } from './extraction.ts';
import type { ParsedReport } from './parser.ts';
import type { SourceStorage } from './storage.ts';

type Db = Pool | PoolClient;
type Document = {
  id: string;
  uploaderId: string;
  title: string;
  sourceKind: 'synthetic' | 'permitted';
  sha256: string | null;
  bytes: number | null;
  parserVersion: string | null;
  status: 'awaiting-upload' | 'review' | 'failed';
  failure: string | null;
};
type Revision = {
  id: string;
  candidateId: string;
  previousId: string | null;
  fields: Candidate;
  actorId: string;
  reason: string;
  createdAt: string;
};
type Decision = {
  id: string;
  candidateId: string;
  revisionId: string;
  actorId: string;
  kind: 'approved' | 'rejected';
  replacesId: string | null;
  recordedAt: string;
  reason: string;
};
const documentColumns =
  'id, uploader_id AS "uploaderId", title, source_kind AS "sourceKind", sha256, byte_count AS bytes, parser_version AS "parserVersion", status, failure';
const revisionColumns =
  'id, candidate_id AS "candidateId", previous_id AS "previousId", fields, actor_id AS "actorId", reason, created_at::text AS "createdAt"';
const decisionColumns =
  'id, candidate_id AS "candidateId", revision_id AS "revisionId", actor_id AS "actorId", kind, replaces_id AS "replacesId", recorded_at::text AS "recordedAt", reason';
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
function fingerprint(value: unknown): string {
  function canonical(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.entries(v)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, val]) => [key, canonical(val)]),
      );
    return v;
  }
  return digest(JSON.stringify(canonical(value)));
}
function input(value: unknown, keys: readonly string[]) {
  const result = object(value);
  onlyKeys(result, keys);
  return result;
}
async function document(db: Db, id: string, lock = false) {
  const result = await db.query<Document>(
    `SELECT ${documentColumns} FROM app.report_documents WHERE id=$1${lock ? ' FOR UPDATE' : ''}`,
    [uuid(id)],
  );
  if (!result.rows[0]) throw new ApiError(404, 'Report not found.');
  return result.rows[0];
}
async function pages(db: Db, id: string) {
  return (
    await db.query<Page>(
      'SELECT page, text FROM app.report_pages WHERE document_id=$1 ORDER BY page',
      [id],
    )
  ).rows;
}

export function createReports({
  pool,
  storage,
  parser,
  extractReport,
  allowPermittedSources = false,
}: {
  pool: Pool;
  storage: SourceStorage;
  parser: { parse(bytes: Buffer): Promise<ParsedReport> };
  extractReport: ExtractReport;
  allowPermittedSources?: boolean;
}) {
  async function admin(token: string) {
    const actor = await authenticateSession(pool, token);
    if (actor.role !== 'admin')
      throw new ApiError(403, 'Assigned admin access required.');
    return actor;
  }
  async function authorized<T>(
    token: string,
    perform: (db: PoolClient, actorId: string) => Promise<T>,
  ): Promise<T> {
    const actor = await admin(token);
    try {
      return await transaction(pool, async (db) => {
        const role = await db.query<{ role: string }>(
          'SELECT role FROM app.principals WHERE id=$1 FOR SHARE',
          [actor.principalId],
        );
        if (role.rows[0]?.role !== 'admin')
          throw new ApiError(403, 'Assigned admin access required.');
        const session = await db.query(
          'SELECT token_hash FROM app.sessions WHERE token_hash=$1 AND principal_id=$2 FOR SHARE',
          [digest(token), actor.principalId],
        );
        if (!session.rowCount) throw new ApiError(401, 'Sign in again.');
        // Check fresh time after the unchanged session row lock has actually been acquired.
        const current = await db.query(
          'SELECT 1 FROM app.sessions WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>clock_timestamp()',
          [digest(token)],
        );
        if (!current.rowCount) throw new ApiError(401, 'Sign in again.');
        const result = await perform(db, actor.principalId);
        const live = await db.query(
          'SELECT 1 FROM app.sessions WHERE token_hash=$1 AND expires_at>clock_timestamp()',
          [digest(token)],
        );
        if (!live.rowCount) throw new ApiError(401, 'Sign in again.');
        return result;
      });
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        ['23505', '40001', '40P01'].includes(String(error.code))
      )
        throw new ApiError(409, 'Report changed. Reload before trying again.');
      throw error;
    }
  }
  async function serialize(db: PoolClient, actorId: string, requestId: string) {
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `report:${actorId}:${requestId}`,
    ]);
  }
  async function candidateDocument(db: PoolClient, id: string) {
    const row = await db.query<{ document_id: string }>(
      'SELECT document_id FROM app.report_candidates WHERE id=$1 FOR UPDATE',
      [uuid(id)],
    );
    if (!row.rows[0]) throw new ApiError(404, 'Candidate not found.');
    return document(db, row.rows[0].document_id);
  }
  async function latest(db: Db, candidateId: string) {
    const result = await db.query<Revision>(
      `SELECT ${revisionColumns} FROM app.report_revisions WHERE candidate_id=$1 ORDER BY sequence DESC LIMIT 1`,
      [candidateId],
    );
    if (!result.rows[0]) throw new ApiError(404, 'Revision not found.');
    return result.rows[0];
  }
  async function detail(token: string, id: string) {
    return authorized(token, async (db) => {
      const doc = await document(db, id);
      const revisions = await db.query<Revision>(
        `SELECT ${revisionColumns} FROM app.report_revisions WHERE candidate_id IN (SELECT id FROM app.report_candidates WHERE document_id=$1) ORDER BY sequence`,
        [id],
      );
      const decisions = await db.query<Decision>(
        `SELECT ${decisionColumns} FROM app.report_decisions WHERE candidate_id IN (SELECT id FROM app.report_candidates WHERE document_id=$1) ORDER BY recorded_at,id`,
        [id],
      );
      const extractions = await db.query(
        'SELECT id, pages, status, metadata, failure FROM app.report_extractions WHERE document_id=$1 ORDER BY created_at,id LIMIT 100',
        [id],
      );
      return {
        ...doc,
        pages: await pages(db, id),
        revisions: revisions.rows,
        decisions: decisions.rows,
        extractions: extractions.rows,
      };
    });
  }
  async function writeRevision(
    db: PoolClient,
    actorId: string,
    candidateId: string,
    previousId: string | null,
    requestId: string,
    fields: Candidate,
    reason: string,
    intent: string,
  ) {
    const result = await db.query<Revision>(
      `INSERT INTO app.report_revisions(id,candidate_id,previous_id,actor_id,request_id,fingerprint,fields,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${revisionColumns}`,
      [
        randomUUID(),
        candidateId,
        previousId,
        actorId,
        requestId,
        intent,
        fields,
        reason,
      ],
    );
    return result.rows[0];
  }
  let extracting = false;
  return {
    detail,
    async access(token: string) {
      return authorized(token, async () => true);
    },
    async list(token: string, after?: string) {
      return authorized(
        token,
        async (db) =>
          (
            await db.query<Document>(
              `SELECT ${documentColumns} FROM app.report_documents WHERE ($1::uuid IS NULL OR id>$1) ORDER BY id LIMIT 50`,
              [after ? uuid(after) : null],
            )
          ).rows,
      );
    },
    async reserve(token: string, value: unknown) {
      const v = input(value, ['requestId', 'title', 'sourceKind']);
      const requestId = uuid(v.requestId),
        title = boundedText(v.title, 160);
      if (
        v.sourceKind !== 'synthetic' &&
        !(allowPermittedSources && v.sourceKind === 'permitted')
      )
        throw new ApiError(
          400,
          'Only authorized synthetic reports are enabled here.',
        );
      return authorized(token, async (db, actorId) => {
        await serialize(db, actorId, requestId);
        const previous = await db.query<Document>(
          `SELECT ${documentColumns} FROM app.report_documents WHERE uploader_id=$1 AND request_id=$2`,
          [actorId, requestId],
        );
        if (previous.rows[0]) {
          if (
            previous.rows[0].title !== title ||
            previous.rows[0].sourceKind !== v.sourceKind
          )
            throw new ApiError(
              409,
              'Request key was already used for another report.',
            );
          return previous.rows[0];
        }
        return (
          await db.query<Document>(
            `INSERT INTO app.report_documents(id,uploader_id,request_id,title,source_kind) VALUES($1,$2,$3,$4,$5) RETURNING ${documentColumns}`,
            [randomUUID(), actorId, requestId, title, v.sourceKind],
          )
        ).rows[0];
      });
    },
    async uploadAccess(token: string, id: string) {
      return authorized(token, async (db, actorId) => {
        const doc = await document(db, id);
        if (doc.uploaderId !== actorId)
          throw new ApiError(404, 'Upload reservation not found.');
        return true;
      });
    },
    async upload(token: string, id: string, bytes: Buffer) {
      await authorized(token, async (db, actorId) => {
        const doc = await document(db, id);
        if (doc.uploaderId !== actorId)
          throw new ApiError(404, 'Upload reservation not found.');
      });
      if (!/^%PDF-(1\.[0-7]|2\.0)/.test(bytes.subarray(0, 8).toString('ascii')))
        throw new ApiError(415, 'Use a PDF document.');
      const saved = await storage.put(id, bytes);
      let parsed: ParsedReport;
      try {
        parsed = await parser.parse(bytes);
      } catch (error) {
        await authorized(token, async (db) => {
          const doc = await document(db, id, true);
          if (doc.status !== 'review')
            await db.query(
              "UPDATE app.report_documents SET status='failed',failure='parse-failed',sha256=$2,byte_count=$3 WHERE id=$1",
              [id, saved.sha256, saved.bytes],
            );
        });
        throw error;
      }
      await authorized(token, async (db, actorId) => {
        const doc = await document(db, id, true);
        if (doc.uploaderId !== actorId)
          throw new ApiError(404, 'Upload reservation not found.');
        if (doc.sha256 && doc.sha256 !== saved.sha256)
          throw new ApiError(409, 'Report source is immutable.');
        if (doc.status === 'review') return;
        await db.query(
          "UPDATE app.report_documents SET sha256=$2,byte_count=$3,parser_version=$4,status='review',failure=NULL WHERE id=$1",
          [id, saved.sha256, saved.bytes, parsed.parserVersion],
        );
        for (const page of parsed.pages)
          await db.query(
            'INSERT INTO app.report_pages(document_id,page,parser_version,text) VALUES($1,$2,$3,$4)',
            [id, page.page, parsed.parserVersion, page.text],
          );
      });
      return detail(token, id);
    },
    async source(token: string, id: string) {
      const doc = await authorized(token, (db) => document(db, id));
      if (!doc.sha256) throw new ApiError(404, 'Source is not uploaded.');
      const bytes = await storage.get(id, doc.sha256);
      await admin(token);
      return bytes;
    },
    async addCandidate(token: string, documentId: string, value: unknown) {
      const v = input(value, ['requestId', 'fields', 'reason']);
      const requestId = uuid(v.requestId),
        reason = boundedText(v.reason, 500);
      return authorized(token, async (db, actorId) => {
        await serialize(db, actorId, requestId);
        const doc = await document(db, documentId);
        if (doc.status !== 'review')
          throw new ApiError(409, 'Report pages are not ready for review.');
        const fields = validateCandidate(v.fields, await pages(db, documentId));
        const intent = fingerprint([documentId, fields, reason]);
        const previous = await db.query<{ id: string; fingerprint: string }>(
          'SELECT id,fingerprint FROM app.report_candidates WHERE actor_id=$1 AND request_id=$2',
          [actorId, requestId],
        );
        if (previous.rows[0]) {
          if (previous.rows[0].fingerprint !== intent)
            throw new ApiError(409, 'Request key conflicts.');
          return (
            await db.query<Revision>(
              `SELECT ${revisionColumns} FROM app.report_revisions WHERE candidate_id=$1 AND previous_id IS NULL`,
              [previous.rows[0].id],
            )
          ).rows[0];
        }
        const candidateId = randomUUID();
        await db.query(
          'INSERT INTO app.report_candidates(id,document_id,actor_id,request_id,fingerprint) VALUES($1,$2,$3,$4,$5)',
          [candidateId, documentId, actorId, requestId, intent],
        );
        return writeRevision(
          db,
          actorId,
          candidateId,
          null,
          requestId,
          fields,
          reason,
          intent,
        );
      });
    },
    async revise(token: string, candidateId: string, value: unknown) {
      const v = input(value, [
        'requestId',
        'expectedRevisionId',
        'fields',
        'reason',
      ]);
      const requestId = uuid(v.requestId),
        expected = uuid(v.expectedRevisionId),
        reason = boundedText(v.reason, 500);
      return authorized(token, async (db, actorId) => {
        await serialize(db, actorId, requestId);
        const doc = await candidateDocument(db, candidateId);
        const fields = validateCandidate(v.fields, await pages(db, doc.id));
        const intent = fingerprint([candidateId, expected, fields, reason]);
        const prior = await db.query<Revision & { fingerprint: string }>(
          `SELECT ${revisionColumns},fingerprint FROM app.report_revisions WHERE actor_id=$1 AND request_id=$2`,
          [actorId, requestId],
        );
        if (prior.rows[0]) {
          if (prior.rows[0].fingerprint !== intent)
            throw new ApiError(409, 'Request key conflicts.');
          const { fingerprint: _fingerprint, ...revision } = prior.rows[0];
          return revision;
        }
        if ((await latest(db, candidateId)).id !== expected)
          throw new ApiError(
            409,
            'Revision changed. Reload before correcting.',
          );
        return writeRevision(
          db,
          actorId,
          candidateId,
          expected,
          requestId,
          fields,
          reason,
          intent,
        );
      });
    },
    async decide(token: string, candidateId: string, value: unknown) {
      const v = input(value, [
        'requestId',
        'revisionId',
        'kind',
        'expectedApprovalId',
        'reason',
      ]);
      const requestId = uuid(v.requestId),
        revisionId = uuid(v.revisionId),
        reason = boundedText(v.reason, 500);
      const expected =
        v.expectedApprovalId === null ? null : uuid(v.expectedApprovalId);
      if (v.kind !== 'approved' && v.kind !== 'rejected')
        throw new ApiError(400, 'Choose approval or rejection.');
      if (v.kind === 'rejected' && expected !== null)
        throw new ApiError(400, 'Rejection cannot replace an approval.');
      const intent = fingerprint([
        candidateId,
        revisionId,
        v.kind,
        expected,
        reason,
      ]);
      return authorized(token, async (db, actorId) => {
        await serialize(db, actorId, requestId);
        const doc = await candidateDocument(db, candidateId);
        const replay = await db.query<Decision & { fingerprint: string }>(
          `SELECT ${decisionColumns},fingerprint FROM app.report_decisions WHERE actor_id=$1 AND request_id=$2`,
          [actorId, requestId],
        );
        if (replay.rows[0]) {
          if (replay.rows[0].fingerprint !== intent)
            throw new ApiError(409, 'Request key conflicts.');
          const { fingerprint: _fingerprint, ...result } = replay.rows[0];
          return result;
        }
        const revision = await latest(db, candidateId);
        if (revision.id !== revisionId)
          throw new ApiError(409, 'Revision changed. Reload before deciding.');
        const decided = await db.query<Decision>(
          `SELECT ${decisionColumns} FROM app.report_decisions WHERE revision_id=$1`,
          [revisionId],
        );
        if (decided.rows[0]) {
          if (
            decided.rows[0].kind !== v.kind ||
            decided.rows[0].replacesId !== expected
          )
            throw new ApiError(
              409,
              'Revision already has a different decision.',
            );
          return decided.rows[0];
        }
        if (v.kind === 'approved') {
          requireApproval(
            validateCandidate(
              candidateInput(revision.fields),
              await pages(db, doc.id),
            ),
          );
          const own = await db.query<{ id: string }>(
            "SELECT d.id FROM app.report_decisions d WHERE d.candidate_id=$1 AND d.kind='approved' AND NOT EXISTS(SELECT 1 FROM app.report_decisions s WHERE s.replaces_id=d.id)",
            [candidateId],
          );
          if (own.rows[0] && own.rows[0].id !== expected)
            throw new ApiError(409, 'Name the current approval to replace.');
          if (expected) {
            const old = await db.query<{ id: string; source_kind: string }>(
              "SELECT d.id,r.source_kind FROM app.report_decisions d JOIN app.report_candidates c ON c.id=d.candidate_id JOIN app.report_documents r ON r.id=c.document_id WHERE d.id=$1 AND d.kind='approved' FOR UPDATE OF d",
              [expected],
            );
            const successor = await db.query(
              'SELECT 1 FROM app.report_decisions WHERE replaces_id=$1',
              [expected],
            );
            if (
              !old.rows[0] ||
              successor.rowCount ||
              old.rows[0].source_kind !== doc.sourceKind
            )
              throw new ApiError(
                409,
                'Expected approval is no longer current.',
              );
          }
        }
        return (
          await db.query<Decision>(
            `INSERT INTO app.report_decisions(id,candidate_id,revision_id,actor_id,request_id,fingerprint,kind,replaces_id,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${decisionColumns}`,
            [
              randomUUID(),
              candidateId,
              revisionId,
              actorId,
              requestId,
              intent,
              v.kind,
              expected,
              reason,
            ],
          )
        ).rows[0];
      });
    },
    async extract(token: string, documentId: string, value: unknown) {
      const v = input(value, ['requestId', 'pages']);
      const requestId = uuid(v.requestId);
      if (!Array.isArray(v.pages) || !v.pages.length || v.pages.length > 8)
        throw new ApiError(400, 'Select one to eight source pages.');
      const selected = v.pages.map((p) => integer(p, 1, 100));
      if (new Set(selected).size !== selected.length)
        throw new ApiError(400, 'Select distinct pages.');
      const intent = fingerprint([documentId, selected]);
      const source = await authorized(token, async (db, actorId) => {
        const doc = await document(db, documentId);
        if (doc.uploaderId !== actorId)
          throw new ApiError(404, 'Extraction source not found.');
        const all = await pages(db, documentId);
        const chosen = selected.map((p) => all.find((page) => page.page === p));
        if (chosen.some((p) => !p))
          throw new ApiError(400, 'Source page unavailable.');
        return {
          permission: doc.sourceKind,
          documentId,
          pages: chosen.filter((p): p is Page => p !== undefined),
        };
      });
      const replay = await authorized(token, async (db, actorId) => {
        const rows = await db.query<{
          id: string;
          fingerprint: string;
          status: string;
          failure: string | null;
        }>(
          'SELECT id,fingerprint,status,failure FROM app.report_extractions WHERE actor_id=$1 AND request_id=$2',
          [actorId, requestId],
        );
        const saved = rows.rows[0];
        if (saved && saved.fingerprint !== intent)
          throw new ApiError(409, 'Request key conflicts.');
        return saved
          ? { id: saved.id, status: saved.status, failure: saved.failure }
          : null;
      });
      if (replay) return replay;
      if (extracting)
        throw new ApiError(503, 'Another report extraction is active.');
      // Feature-level transfer authority is separate from a client permission field.
      extracting = true;
      try {
        const result =
          source.permission !== 'synthetic'
            ? { kind: 'unavailable' as const, reason: 'disabled' as const }
            : await extractCandidates({ source, extractReport });
        return await authorized(token, async (db, actorId) => {
          await serialize(db, actorId, requestId);
          const previous = await db.query<{
            id: string;
            fingerprint: string;
            status: string;
            failure: string | null;
          }>(
            'SELECT id,fingerprint,status,failure FROM app.report_extractions WHERE actor_id=$1 AND request_id=$2',
            [actorId, requestId],
          );
          if (previous.rows[0]) {
            if (previous.rows[0].fingerprint !== intent)
              throw new ApiError(409, 'Request key conflicts.');
            return previous.rows[0];
          }
          const id = randomUUID();
          await db.query(
            'INSERT INTO app.report_extractions(id,document_id,actor_id,request_id,fingerprint,pages,status,metadata,failure) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
            [
              id,
              documentId,
              actorId,
              requestId,
              intent,
              selected,
              result.kind,
              result.kind === 'review' ? result.metadata : null,
              result.kind === 'unavailable' ? result.reason : null,
            ],
          );
          if (result.kind === 'review')
            for (const fields of result.candidates) {
              const candidateId = randomUUID(),
                key = randomUUID();
              await db.query(
                'INSERT INTO app.report_candidates(id,document_id,extraction_id,actor_id,request_id,fingerprint) VALUES($1,$2,$3,$4,$5,$6)',
                [
                  candidateId,
                  documentId,
                  id,
                  actorId,
                  key,
                  fingerprint(fields),
                ],
              );
              await writeRevision(
                db,
                actorId,
                candidateId,
                null,
                key,
                fields,
                'Extracted candidate; human review required.',
                fingerprint(fields),
              );
            }
          return {
            id,
            status: result.kind,
            failure: result.kind === 'unavailable' ? result.reason : null,
          };
        });
      } finally {
        extracting = false;
      }
    },
    async official(token: string) {
      await authenticateSession(pool, token);
      const result = await pool.query<{
        approvalId: string;
        candidateId: string;
        fields: Candidate;
        sourceKind: 'synthetic' | 'permitted';
        documentId: string;
        title: string;
        sha256: string;
        parserVersion: string;
        reviewerId: string;
        approvedAt: string;
      }>(
        `SELECT d.id AS "approvalId",d.candidate_id AS "candidateId",v.fields,r.source_kind AS "sourceKind",r.id AS "documentId",r.title,r.sha256,r.parser_version AS "parserVersion",d.actor_id AS "reviewerId",d.recorded_at::text AS "approvedAt" FROM app.report_decisions d JOIN app.report_revisions v ON v.id=d.revision_id JOIN app.report_candidates c ON c.id=d.candidate_id JOIN app.report_documents r ON r.id=c.document_id WHERE d.kind='approved' AND NOT EXISTS(SELECT 1 FROM app.report_decisions s WHERE s.replaces_id=d.id) ORDER BY d.recorded_at DESC,d.id LIMIT 100`,
      );
      return result.rows.map((row) => ({
        ...row,
        fields: row.fields.fields,
        evidence: row.fields.evidence,
        missing: row.fields.missing,
        period: row.fields.fields.period?.text ?? null,
      }));
    },
  };
}
