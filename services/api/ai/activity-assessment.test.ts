import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createActivityAssessment,
  type ActivityProvider,
  type ActivityAssessmentResult,
} from './activity-assessment.ts';

function reason(result: ActivityAssessmentResult) {
  assert.equal(result.kind, 'unavailable');
  return result.reason;
}

function input() {
  return {
    photo: new Uint8Array([1, 2, 3]),
    mime: 'image/jpeg',
    capture: 'camera',
    description: 'Synthetic bus journey',
    fingerprint: 'fixture-fingerprint',
    eligibility: {
      eligible: true,
      duplicate: false,
      actionAlreadyRewarded: false,
      tripAlreadyRewarded: false,
    },
  };
}
const observations = { observations: ['A synthetic bus interior.'] };
const decision = {
  verdict: 'supported',
  activity: 'bus-trip',
  confidence: 0.51,
};

test('default provider is disabled and consumes transient photo without any fetch', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => {
    throw Error('no traffic');
  });
  const source = input();
  assert.equal(
    reason(await createActivityAssessment().assess(source)),
    'protocol-unverified',
  );
  assert.deepEqual([...source.photo], [0, 0, 0]);
  assert.equal(source.description, '');
  assert.equal(fetch.mock.callCount(), 0);
});

test('one observation then one activity decision; result has no original, description, observations or award', async () => {
  const source = input();
  const calls: string[] = [];
  const ai = createActivityAssessment({
    provider: {
      observe: async (value) => {
        calls.push('luna');
        assert.equal(value.description, source.description);
        return observations;
      },
      decide: async (value) => {
        calls.push('jev');
        assert.deepEqual(value, observations);
        return decision;
      },
    },
  });
  const result = await ai.assess(source);
  assert.deepEqual(result, {
    kind: 'candidate',
    activity: 'bus-trip',
    confidence: 0.51,
    fingerprint: source.fingerprint,
    requiresEligibilityRecheck: true,
  });
  assert.deepEqual(calls, ['luna', 'jev']);
  assert.deepEqual([...source.photo], [0, 0, 0]);
  assert.equal(source.description, '');
});

test('strict >50 gate is independent of verdict; missing or invalid confidence never qualifies', async () => {
  for (const value of [
    { ...decision, confidence: 0.5 },
    { ...decision, confidence: 0 },
    { ...decision, confidence: null },
    { ...decision, confidence: NaN },
    { ...decision, confidence: 51 },
    { ...decision, confidence: undefined },
    { ...decision, verdict: 'not-supported', confidence: 1 },
    { ...decision, verdict: 'uncertain', confidence: 1 },
    { ...decision, points: 50 },
    { ...decision, approved: true },
  ]) {
    const source = input();
    const result = await createActivityAssessment({
      provider: {
        observe: async () => observations,
        decide: async () => value,
      },
    }).assess(source);
    assert.notEqual(result.kind, 'candidate');
    assert.deepEqual([...source.photo], [0, 0, 0]);
    assert.equal(source.description, '');
  }
});

test('server eligibility, duplicate, action and trip payment checks each prevent provider calls', async () => {
  for (const eligibility of [
    { ...input().eligibility, eligible: false },
    { ...input().eligibility, duplicate: true },
    { ...input().eligibility, actionAlreadyRewarded: true },
    { ...input().eligibility, tripAlreadyRewarded: true },
  ]) {
    let calls = 0;
    const source = { ...input(), eligibility };
    const result = await createActivityAssessment({
      provider: {
        observe: async () => {
          calls++;
          return observations;
        },
        decide: async () => {
          calls++;
          return decision;
        },
      },
    }).assess(source);
    assert.equal(result.kind, 'ineligible');
    assert.equal(calls, 0);
    assert.deepEqual([...source.photo], [0, 0, 0]);
    assert.equal(source.description, '');
  }
});

test('no daily cap or location requirement is invented by repeated assessments', async () => {
  const ai = createActivityAssessment({
    provider: {
      observe: async () => observations,
      decide: async () => decision,
    },
  });
  for (let i = 0; i < 3; i++)
    assert.equal(
      (await ai.assess({ ...input(), fingerprint: `distinct-${i}` })).kind,
      'candidate',
    );
});

test('invalid camera/mime/oversize/description input is rejected and its owned photo cleared', async () => {
  for (const source of [
    { ...input(), capture: 'gallery' },
    { ...input(), mime: 'image/svg+xml' },
    { ...input(), description: 'x'.repeat(1601) },
    { ...input(), photo: new Uint8Array(2_000_001).fill(1) },
    { ...input(), photo: new Uint8Array() },
    { ...input(), apiKey: 'synthetic' },
  ]) {
    const result = await createActivityAssessment().assess(source);
    assert.equal(reason(result), 'invalid-input');
    assert.ok(source.photo.every((v) => v === 0));
  }
});

test('malformed/oversize/authority observations and stage errors fail without second call or raw errors', async () => {
  for (const response of [
    null,
    { observations: [] },
    { observations: ['x'.repeat(401)] },
    { observations: ['safe'], points: 50 },
    { observations: Array(9).fill('safe') },
  ]) {
    let calls = 0;
    const source = input();
    const result = await createActivityAssessment({
      provider: {
        observe: async () => response,
        decide: async () => {
          calls++;
          return decision;
        },
      },
    }).assess(source);
    assert.equal(reason(result), 'invalid-output');
    assert.equal(calls, 0);
    assert.ok(source.photo.every((v) => v === 0));
  }
  for (const stage of ['observe', 'decide']) {
    const result = await createActivityAssessment({
      provider: {
        observe: async () => {
          if (stage === 'observe') throw Error('synthetic-sensitive-error');
          return observations;
        },
        decide: async () => {
          throw Error('synthetic-sensitive-error');
        },
      },
    }).assess(input());
    assert.equal(reason(result), 'provider');
    assert.equal(
      JSON.stringify(result).includes('synthetic-sensitive-error'),
      false,
    );
  }
});

test('deadline/cancellation clear photo, prevent stage two and retain concurrency slot until provider exits', async () => {
  let release: ((value: unknown) => void) | undefined;
  const held = new Promise<unknown>((resolve) => {
    release = resolve;
  });
  let decisions = 0;
  const ai = createActivityAssessment({
    timeoutMs: 10,
    provider: {
      observe: async () => held,
      decide: async () => {
        decisions++;
        return decision;
      },
    },
  });
  const source = input();
  const pending = ai.assess(source);
  assert.equal(reason(await ai.assess(input())), 'busy');
  assert.equal(reason(await pending), 'timeout');
  assert.ok(source.photo.every((v) => v === 0));
  assert.equal(reason(await ai.assess(input())), 'busy');
  release?.(observations);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(decisions, 0);
  const controller = new AbortController();
  controller.abort();
  const cancelled = input();
  assert.equal(
    reason(await ai.assess(cancelled, controller.signal)),
    'cancelled',
  );
  assert.ok(cancelled.photo.every((v) => v === 0));
});

test('mid-flight cancellation clears transient values and cannot become a late candidate', async () => {
  const controller = new AbortController();
  let finish: ((value: unknown) => void) | undefined;
  let started: (() => void) | undefined;
  const arrived = new Promise<void>((resolve) => {
    started = resolve;
  });
  const held = new Promise<unknown>((resolve) => {
    finish = resolve;
  });
  let observed: Parameters<ActivityProvider['decide']>[0] | undefined;
  const ai = createActivityAssessment({
    provider: {
      observe: async () => observations,
      decide: async (value) => {
        observed = value;
        started?.();
        return held;
      },
    },
  });
  const source = input();
  const pending = ai.assess(source, controller.signal);
  await arrived;
  controller.abort();
  assert.equal(reason(await pending), 'cancelled');
  assert.equal(source.description, '');
  assert.ok(source.photo.every((value) => value === 0));
  assert.deepEqual(observed?.observations, ['']);
  assert.equal(reason(await ai.assess(input())), 'busy');
  finish?.(decision);
  await new Promise((resolve) => setImmediate(resolve));
});
