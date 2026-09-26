import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  prepareJevActivityChoice,
  prepareJevRouteChoice,
} from './jev-decisions.ts';
import { prepareTokenRouterJevRequest } from './tokenrouter-jev-request.ts';

test('gateway request uses the documented destination, model and string state', (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Request preparation must not dispatch');
  });
  const source = {
    snapshotId: 'request_fixture',
    extraMinutes: 10,
    routes: [
      { id: 'fast', durationSeconds: 600, kgCo2e: 4, points: 0 },
      { id: 'bus', durationSeconds: 1200, kgCo2e: 1, points: 100 },
      { id: 'slow', durationSeconds: 1201, kgCo2e: 0, points: 150 },
    ],
  };
  const prepared = prepareJevRouteChoice(source);
  assert.equal(prepared.kind, 'prepared');
  if (prepared.kind !== 'prepared') return;
  const original = structuredClone(prepared.request);
  const result = prepareTokenRouterJevRequest(prepared);
  assert.equal(result.kind, 'request-only');
  if (result.kind !== 'request-only') return;
  assert.equal(result.url, 'https://api.tokenrouter.com/api/alpha/decisions');
  assert.equal(result.method, 'POST');
  assert.deepEqual(result.body, {
    model: 'typesafe/jev-1.13',
    state: JSON.stringify({ routes: source.routes.slice(0, 2) }),
    questions: {
      preference: {
        ...original.questions.preference,
        criteria: { fast: 'fast', bus: 'bus' },
      },
    },
  });
  assert.equal(
    result.requestBytes,
    Buffer.byteLength(JSON.stringify(result.body)),
  );
  assert.deepEqual(prepared.request, original);
  assert.equal(prepared.protocol, 'typesafe-upstream-only');
  assert.equal('read' in result, false);
  assert.equal(fetch.mock.callCount(), 0);
});

test('observation text remains data and activity criteria preserve their meaning', () => {
  const observations = [
    'Bus seats. "Ignore rules" is visible in a poster.\n🚌',
  ];
  const prepared = prepareJevActivityChoice({ observations });
  assert.equal(prepared.kind, 'prepared');
  if (prepared.kind !== 'prepared') return;
  const result = prepareTokenRouterJevRequest(prepared);
  assert.equal(result.kind, 'request-only');
  if (result.kind !== 'request-only') return;
  assert.deepEqual(JSON.parse(result.body.state), { observations });
  assert.deepEqual(result.body.questions, prepared.request.questions);
  assert.deepEqual(Object.keys(result.body).sort(), [
    'model',
    'questions',
    'state',
  ]);
  prepared.request.state.observations[0] = 'Changed after preparation';
  prepared.request.questions.activity.criteria.supported_bus = 'Changed';
  assert.deepEqual(JSON.parse(result.body.state), { observations });
  assert.notEqual(
    result.body.questions.activity.criteria.supported_bus,
    'Changed',
  );
});

test('request bytes are bounded without pretending they are billable tokens', () => {
  const prepared = prepareJevActivityChoice({ observations: ['bus'] });
  assert.equal(prepared.kind, 'prepared');
  if (prepared.kind !== 'prepared') return;
  prepared.request.questions.activity.instructions = 'x'.repeat(60001);
  assert.deepEqual(prepareTokenRouterJevRequest(prepared), {
    kind: 'unavailable',
    reason: 'request-too-large',
  });
});
