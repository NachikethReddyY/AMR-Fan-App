import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createActivitySubmissionAssessor,
  selectActivityAssessment,
} from '../ai/activity-submission.ts';
import {
  validateActivityAssessmentOutput,
  type ActivityAssessmentOutput,
} from '../ai/activity-assessment.ts';

function submission() {
  return {
    requestId: '123e4567-e89b-42d3-a456-426614174000',
    description: 'bus',
    missionId: null,
    payloadDigest: 'a'.repeat(64),
    photos: [{ bytes: Buffer.from([1, 2, 3]), fingerprint: 'b'.repeat(64) }],
  };
}
const out = (score = 60): ActivityAssessmentOutput => ({
  category: 'active_transport',
  evidenceScore: score,
  confidence: 0.9,
  rationale: 'clear evidence',
  evidenceItems: ['bus'],
  modelVersion: 'fixture-1',
});

test('assessment policy boundaries: 59 rejects, 60 accepts, other/unclear are uncertain', async () => {
  for (const [score, kind] of [
    [59, 'rejected'],
    [60, 'accepted'],
    [100, 'accepted'],
  ]) {
    const s = submission();
    const r = await createActivitySubmissionAssessor({
      provider: { assess: async () => out(score as number) },
    }).assess(s);
    assert.equal(r.kind, kind);
    assert.deepEqual([...s.photos[0].bytes], [0, 0, 0]);
  }
  for (const category of ['other', 'unclear']) {
    const s = submission();
    const r = await createActivitySubmissionAssessor({
      provider: { assess: async () => ({ ...out(100), category }) },
    }).assess(s);
    assert.equal(r.kind, 'uncertain');
  }
});

test('strict output rejects authority fields and invalid score', () => {
  assert.throws(() =>
    validateActivityAssessmentOutput({ ...out(), points: 999, approved: true }),
  );
  assert.throws(() =>
    validateActivityAssessmentOutput({ ...out(), evidenceScore: 101 }),
  );
});

test('AI selector applies the existing evidence policy without awarding points', () => {
  const base = out(80);
  assert.deepEqual(
    selectActivityAssessment(base, '00000000-0000-4000-8000-000000000001'),
    {
      kind: 'accepted',
      assessmentId: '00000000-0000-4000-8000-000000000001',
      ...base,
      policyVersion: 'activity-evidence-v1',
    },
  );
  assert.deepEqual(
    selectActivityAssessment(
      { ...base, evidenceScore: 59 },
      '00000000-0000-4000-8000-000000000001',
    ),
    {
      kind: 'rejected',
      reason: 'unsupported_activity',
      rationale: 'clear evidence',
    },
  );
  assert.deepEqual(
    selectActivityAssessment(
      { ...base, confidence: 0.5 },
      '00000000-0000-4000-8000-000000000001',
    ),
    {
      kind: 'uncertain',
      reason: 'low_confidence',
      rationale: 'clear evidence',
    },
  );
  assert.ok(
    !(
      'points' in
      selectActivityAssessment(base, '00000000-0000-4000-8000-000000000001')
    ),
  );
});

test('planting is an accepted category with hands-on evidence', () => {
  const result = selectActivityAssessment(
    {
      ...out(80),
      category: 'planting',
      rationale: 'Hands covering a seedling with a soil shovel outdoors.',
      evidenceItems: ['hands', 'shovel with soil', 'seedling'],
    },
    '00000000-0000-4000-8000-000000000001',
  );
  assert.equal(result.kind, 'accepted');
});

test('watch metrics verb never trips the screen rule; depicted screens still fail', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  assert.equal(
    selectActivityAssessment(
      {
        ...out(80),
        category: 'active_transport',
        rationale: 'A wrist-worn watch displays live workout metrics outdoors.',
        evidenceItems: ['watch', 'elapsed time', 'heart rate'],
      },
      id,
    ).kind,
    'accepted',
  );
  assert.deepEqual(
    selectActivityAssessment(
      {
        ...out(90),
        rationale: 'A smartphone showing a photo of a run.',
        evidenceItems: ['smartphone display'],
      },
      id,
    ),
    {
      kind: 'rejected',
      reason: 'invalid_evidence',
      rationale: 'A smartphone showing a photo of a run.',
    },
  );
});

test('potted balcony gardening is awardable with visible hands-on care', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  assert.equal(
    selectActivityAssessment(
      {
        ...out(85),
        category: 'planting',
        rationale:
          'A hand is using a trowel in the soil of a potted plant on a balcony.',
        evidenceItems: ['hand', 'trowel', 'soil', 'potted plant'],
      },
      id,
    ).kind,
    'accepted',
  );
});
test('screen depictions are rejected even beside real plants', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  assert.deepEqual(
    selectActivityAssessment(
      {
        ...out(100),
        rationale: 'A computer screen shows a planting photo indoors.',
        evidenceItems: ['laptop display', 'potted plant'],
      },
      id,
    ),
    {
      kind: 'rejected',
      reason: 'invalid_evidence',
      rationale: 'A computer screen shows a planting photo indoors.',
    },
  );
});

test('timeout returns promptly, retains bytes until an abort-ignoring provider settles, then clears them', async () => {
  const s = submission();
  let sawBytes = false;
  const r = await createActivitySubmissionAssessor({
    timeoutMs: 10,
    provider: {
      assess: async ({ photos }) =>
        new Promise((resolve) =>
          setTimeout(() => {
            sawBytes = photos[0].bytes[0] === 1;
            resolve(out());
          }, 50),
        ),
    },
  }).assess(s);
  assert.deepEqual(r, { kind: 'unavailable', reason: 'timeout' });
  assert.equal(sawBytes, false);
  assert.deepEqual([...s.photos[0].bytes], [1, 2, 3]);
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(sawBytes, true);
  assert.deepEqual([...s.photos[0].bytes], [0, 0, 0]);
});
