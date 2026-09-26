import { createRecorder, type StoredCapture } from './recorder';
import type { Journey } from './contracts';
import type { JourneyApi } from './api';

const ctx = {
  token: 'synthetic',
  profileId: '00000000-0000-4000-8000-000000000001',
};
const journey: Journey = {
  id: '00000000-0000-4000-8000-000000000002',
  profileId: ctx.profileId,
  state: 'prepared',
  mode: 'walk',
  source: { kind: 'fixture', label: 'Synthetic' },
  startedAtMs: null,
  finishedAtMs: null,
  captureSessionId: null,
  preciseExpiresAtMs: 999999,
  assessment: {
    version: 'v1',
    revision: 0,
    calibration: 'unvalidated',
    status: 'unfinished',
    reasons: [],
    startRecorded: false,
    arrivalRecorded: false,
    sampleCount: 0,
  },
};
function setup() {
  let stored: StoredCapture | null = null,
    now = 1000,
    sequence = 10;
  const events: string[] = [];
  let current: Journey = {
    ...journey,
    state: 'active',
    startedAtMs: 1000,
    captureSessionId: null,
  };
  const api = {
    start: jest.fn<
      ReturnType<JourneyApi['start']>,
      Parameters<JourneyApi['start']>
    >(async (_ctx, _id, _request, captureSessionId) => {
      events.push('ack');
      current = { ...current, captureSessionId };
      return current;
    }),
    evidence: jest.fn<
      ReturnType<JourneyApi['evidence']>,
      Parameters<JourneyApi['evidence']>
    >(async () => current),
    finish: jest.fn<
      ReturnType<JourneyApi['finish']>,
      Parameters<JourneyApi['finish']>
    >(async (_ctx, _id, _request, _session, endedAtMs) => {
      current = { ...current, state: 'finished', finishedAtMs: endedAtMs };
      return current;
    }),
    read: jest.fn(async () => current),
    settle: jest.fn<
      ReturnType<JourneyApi['settle']>,
      Parameters<JourneyApi['settle']>
    >(async () => ({
      creditedPoints: 0,
      cumulativeAutomaticCredit: 0,
      targetPoints: 0,
      creditContext: 'production_unavailable' as const,
      receipt: {
        journeyId: journey.id,
        profileId: ctx.profileId,
        result: {
          productionCredit: {
            kind: 'unavailable' as const,
            reasons: ['calibration_unvalidated'],
          },
          decision: {
            kind: 'no_award' as const,
            reason: 'insufficient_evidence',
          },
        },
      },
    })),
  };
  const location = {
    isRunning: jest.fn(async () => true),
    permission: jest.fn(async () => true),
    start: jest.fn(async () => {
      events.push('collect');
    }),
    stop: jest.fn(async () => {
      events.push('stop');
    }),
  };
  const store = {
    read: async () => stored,
    write: async (value: StoredCapture | null) => {
      stored = value ? structuredClone(value) : null;
    },
  };
  const create = () =>
    createRecorder({
      api,
      location,
      store,
      now: () => now,
      uuid: () =>
        `00000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`,
      onExpired: async () => {},
    });
  return {
    create,
    api,
    location,
    events,
    store,
    setNow: (v: number) => {
      now = v;
    },
  };
}
const sample = {
  id: '00000000-0000-4000-8000-000000000100',
  acquiredAtMs: 1100,
  receivedAtMs: 1100,
  latitude: 1.3,
  longitude: 103.8,
  accuracyMeters: 5,
  context: 'foreground' as const,
  mocked: false,
};
test('denied permission does not Start or collect; collection follows server acknowledgment', async () => {
  const x = setup(),
    r = x.create();
  x.location.permission.mockResolvedValueOnce(false);
  await r.begin(ctx, journey);
  expect(x.api.start).not.toHaveBeenCalled();
  await r.begin(ctx, journey);
  expect(x.events).toEqual(['ack', 'collect']);
});
test('lost Start response retries the persisted IDs before collecting', async () => {
  const x = setup(),
    r = x.create();
  x.api.start.mockRejectedValueOnce(new Error('lost response'));
  await r.begin(ctx, journey);
  expect(x.location.start).not.toHaveBeenCalled();
  const first = x.api.start.mock.calls[0];
  const restarted = x.create();
  await restarted.restore(ctx);
  await restarted.retry();
  expect(x.api.start.mock.calls[1]).toEqual(first);
  expect(x.location.start).toHaveBeenCalledTimes(1);
});
test('offline evidence retains original timestamps and batch identity across restart', async () => {
  const x = setup(),
    r = x.create();
  await r.begin(ctx, journey);
  x.setNow(1200);
  await r.collect([sample]);
  x.api.evidence.mockRejectedValueOnce(new Error('offline'));
  await r.retry();
  const first = x.api.evidence.mock.calls[0];
  const restarted = x.create();
  await restarted.restore(ctx);
  await restarted.retry();
  expect(x.api.evidence.mock.calls[1]).toEqual(first);
  expect((await x.store.read())?.samples).toEqual([]);
});
test('finish stops collection before networking, preserves offline finish time and shows real no-credit result', async () => {
  const x = setup(),
    r = x.create();
  await r.begin(ctx, journey);
  x.setNow(1200);
  await r.collect([sample]);
  x.api.finish.mockRejectedValueOnce(new Error('offline'));
  await r.finish('arrival');
  const first = x.api.finish.mock.calls[0];
  expect(x.location.stop).toHaveBeenCalled();
  await r.collect([{ ...sample, id: 'too-late', acquiredAtMs: 1400 }]);
  x.setNow(2000);
  await r.retry();
  expect(x.api.finish.mock.calls[1]).toEqual(first);
  expect(r.getState().capture?.samples).toEqual([]);
  expect(r.getState().award?.creditedPoints).toBe(0);
  expect(r.getState().award?.creditContext).toBe('production_unavailable');
});
test('account invalidation stops capture and erases private queue; foreign profile never resumes it', async () => {
  const x = setup(),
    r = x.create();
  await r.begin(ctx, journey);
  await r.collect([sample]);
  const restarted = x.create();
  await restarted.restore({ ...ctx, profileId: 'other' });
  expect(x.location.stop).toHaveBeenCalled();
  expect(await x.store.read()).toBeNull();
  expect(restarted.getState().capture).toBeNull();
});
test('finish cutoff rejects a late OS callback while an earlier upload is in flight', async () => {
  const x = setup(),
    r = x.create();
  await r.begin(ctx, journey);
  x.setNow(1200);
  await r.collect([sample]);
  let release: ((value: Journey) => void) | undefined;
  x.api.evidence.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const upload = r.retry();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const finish = r.finish('arrival');
  x.setNow(1400);
  const late = r.collect([
    {
      ...sample,
      id: '00000000-0000-4000-8000-000000000101',
      acquiredAtMs: 1300,
      receivedAtMs: 1300,
    },
  ]);
  if (!release) throw new Error('Upload did not begin');
  release({ ...journey, state: 'active' });
  await Promise.all([upload, finish, late]);
  expect(
    x.api.evidence.mock.calls.flatMap((call) => call[4]).map((s) => s.id),
  ).toEqual([sample.id]);
  expect(x.api.finish.mock.calls[0][4]).toBe(1200);
});
test('identity invalidation during native start stops the late collector and leaves no private queue', async () => {
  const x = setup(),
    r = x.create();
  let release: (() => void) | undefined;
  x.location.start.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const begin = r.begin(ctx, journey);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const invalidated = r.invalidate();
  if (!release) throw new Error('Native start did not begin');
  release();
  await Promise.all([begin, invalidated]);
  expect(r.getState().collecting).toBe(false);
  expect(await x.store.read()).toBeNull();
  expect(x.location.stop).toHaveBeenCalledTimes(2);
});
test('headless collection error retains a finish intent without calling authenticated APIs', async () => {
  const x = setup(),
    r = x.create();
  await r.begin(ctx, journey);
  const headless = x.create();
  x.setNow(1500);
  await headless.interrupt('interrupted');
  expect((await x.store.read())?.finish?.endedAtMs).toBe(1500);
  expect(x.api.finish).not.toHaveBeenCalled();
  const resumed = x.create();
  await resumed.restore(ctx);
  await resumed.retry();
  expect(x.api.finish.mock.calls[0][4]).toBe(1500);
});
test('Stop during lost Start acknowledgment never begins location and retries the same finish time', async () => {
  const x = setup(),
    r = x.create();
  x.api.start.mockRejectedValueOnce(new Error('lost acknowledgment'));
  x.api.read.mockImplementation(async () => ({
    ...journey,
    state: 'active',
    startedAtMs: 1000,
    captureSessionId: (await x.store.read())?.captureSessionId ?? null,
  }));
  await r.begin(ctx, journey);
  x.setNow(1500);
  await r.finish('stopped');
  expect(x.location.start).not.toHaveBeenCalled();
  expect(x.api.finish.mock.calls[0]?.[4]).toBe(1500);
  expect(r.getState().capture?.phase).toBe('finished');
});
test('Stop while native start is pending stops its late collector', async () => {
  const x = setup(),
    r = x.create();
  let release: (() => void) | undefined;
  x.location.start.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const begin = r.begin(ctx, journey);
  await new Promise((resolve) => setTimeout(resolve, 0));
  x.setNow(1500);
  const finish = r.finish('stopped');
  if (!release) throw new Error('Native start did not begin');
  release();
  await Promise.all([begin, finish]);
  expect(r.getState().collecting).toBe(false);
  expect(x.events.at(-1)).toBe('stop');
  expect(x.api.finish.mock.calls[0]?.[4]).toBe(1500);
});
test('restore reports an existing OS collector without starting a second one', async () => {
  const x = setup(),
    r = x.create();
  await r.begin(ctx, journey);
  const restored = x.create();
  await restored.restore(ctx);
  expect(restored.getState().collecting).toBe(true);
  expect(x.location.start).toHaveBeenCalledTimes(1);
});
test('stopping an unacknowledged Start never creates a new server capture after the stop time', async () => {
  const x = setup(),
    r = x.create();
  x.api.start.mockRejectedValueOnce(new Error('offline before request'));
  x.api.read.mockResolvedValueOnce(journey);
  await r.begin(ctx, journey);
  x.setNow(1500);
  await r.finish('stopped');
  expect(x.api.start).toHaveBeenCalledTimes(1);
  expect(x.location.start).not.toHaveBeenCalled();
  expect(r.getState().capture).toBeNull();
});
test('identity invalidation cancels a queued Start before it requests permission', async () => {
  const x = setup(),
    r = x.create();
  let release: ((value: Journey) => void) | undefined;
  x.api.start.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const first = r.begin(ctx, journey);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const queued = r.begin(ctx, journey);
  const invalidated = r.invalidate();
  if (!release) throw new Error('Start was not sent');
  release({ ...journey, state: 'active' });
  await Promise.all([first, queued, invalidated]);
  expect(x.api.start).toHaveBeenCalledTimes(1);
  expect(x.location.permission).toHaveBeenCalledTimes(1);
  expect(await x.store.read()).toBeNull();
});
test('a native Stop failure still persists the original finish intent for recovery', async () => {
  const x = setup(),
    r = x.create();
  await r.begin(ctx, journey);
  x.setNow(1500);
  x.location.stop.mockRejectedValue(new Error('OS unavailable'));
  await r.finish('stopped');
  expect((await x.store.read())?.finish?.endedAtMs).toBe(1500);
  expect(x.api.finish).not.toHaveBeenCalled();
  x.location.stop.mockResolvedValue();
  x.setNow(3000);
  await r.retry();
  expect(x.api.finish.mock.calls[0]?.[4]).toBe(1500);
});
test('an in-flight upload cannot delay durable GPS capture or the finish intent', async () => {
  const x = setup(),
    r = x.create();
  await r.begin(ctx, journey);
  x.setNow(1200);
  await r.collect([sample]);
  let release: ((value: Journey) => void) | undefined;
  x.api.evidence.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const upload = r.retry();
  await new Promise((resolve) => setTimeout(resolve, 0));
  x.setNow(1400);
  const next = {
    ...sample,
    id: '00000000-0000-4000-8000-000000000101',
    acquiredAtMs: 1300,
    receivedAtMs: 1300,
  };
  const collect = r.collect([next]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const savedWhileUploading = (await x.store.read())?.samples.map((s) => s.id);
  const finish = r.finish('arrival');
  await new Promise((resolve) => setTimeout(resolve, 0));
  const stoppedWhileUploading = (await x.store.read())?.finish?.endedAtMs;
  if (!release) throw new Error('Upload did not begin');
  release(journey);
  await Promise.all([upload, collect, finish]);
  expect(savedWhileUploading).toContain(next.id);
  expect(stoppedWhileUploading).toBe(1400);
  expect(
    x.api.evidence.mock.calls.flatMap((c) => c[4]).map((s) => s.id),
  ).toEqual([sample.id, next.id]);
});
test('identity invalidation waits for an in-flight encrypted write before erasing it', async () => {
  const x = setup(),
    r = x.create();
  const write = x.store.write;
  let release: (() => void) | undefined;
  x.store.write = async (value) => {
    if (value?.phase === 'starting')
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    await write(value);
  };
  const begin = r.begin(ctx, journey);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const invalidated = r.invalidate();
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (!release) throw new Error('Write did not start');
  release();
  await Promise.all([begin, invalidated]);
  expect(await x.store.read()).toBeNull();
  expect(x.api.start).not.toHaveBeenCalled();
});
test('expired capture is removed and cannot resume or upload', async () => {
  const x = setup(),
    r = x.create();
  await r.begin(ctx, journey);
  x.setNow(999999);
  await r.retry();
  expect(await x.store.read()).toBeNull();
  expect(r.getState().collecting).toBe(false);
  expect(x.api.evidence).not.toHaveBeenCalled();
});
test('Stop cutoff survives restart and rejects headless callbacks without session credentials', async () => {
  const x = setup(),
    r = x.create();
  await r.begin(ctx, journey);
  x.setNow(1500);
  x.api.finish.mockRejectedValueOnce(new Error('offline'));
  await r.finish('stopped');
  const headless = x.create();
  x.setNow(3000);
  await headless.collect([
    { ...sample, acquiredAtMs: 2000, receivedAtMs: 2100 },
  ]);
  expect((await x.store.read())?.samples).toEqual([]);
  expect((await x.store.read())?.finish?.endedAtMs).toBe(1500);
  expect(x.api.evidence).not.toHaveBeenCalled();
});

test.each([false, true])(
  'successor capture waits for deferred identity cleanup (same profile: %s)',
  async (sameProfile) => {
    const x = setup(),
      r = x.create();
    let running = false;
    x.location.start.mockImplementation(async () => {
      running = true;
    });
    x.location.stop.mockImplementation(async () => {
      running = false;
    });
    x.location.isRunning.mockImplementation(async () => running);
    x.api.start.mockImplementation(
      async (context, id, _request, captureSessionId) => ({
        ...journey,
        id,
        profileId: context.profileId,
        state: 'active',
        startedAtMs: 1000,
        captureSessionId,
      }),
    );
    await r.begin(ctx, journey);
    let release: (() => void) | undefined;
    x.location.stop.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      running = false;
    });
    const invalidating = r.invalidate();
    const nextContext = {
      token: 'successor',
      profileId: sameProfile
        ? ctx.profileId
        : '00000000-0000-4000-8000-000000000004',
    };
    const nextJourney = {
      ...journey,
      id: '00000000-0000-4000-8000-000000000005',
      profileId: nextContext.profileId,
    };
    const restoring = r.restore(nextContext);
    const beginning = r.begin(nextContext, nextJourney);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const beforeRelease = {
      capture: r.getState().capture,
      starts: x.api.start.mock.calls.length,
    };
    if (!release) throw new Error('Cleanup did not stop');
    release();
    await Promise.all([invalidating, restoring, beginning]);
    expect(beforeRelease).toEqual({ capture: null, starts: 1 });
    expect((await x.store.read())?.journey.id).toBe(nextJourney.id);
    expect(r.getState().capture?.journey.id).toBe(nextJourney.id);
    expect(r.getState().collecting).toBe(true);
    expect(running).toBe(true);
  },
);

test('unacknowledged settlement survives clear and replacement, then retries its original key', async () => {
  const x = setup(),
    r = x.create();
  await r.begin(ctx, journey);
  x.api.settle.mockRejectedValueOnce(new Error('offline before settlement'));
  await r.finish('arrival');
  const retained = await x.store.read();
  expect(retained?.phase).toBe('finished');
  const requestId = retained?.settlement?.requestId;
  await r.clear();
  await r.begin(ctx, {
    ...journey,
    id: '00000000-0000-4000-8000-000000000005',
  });
  expect((await x.store.read())?.settlement?.requestId).toBe(requestId);
  expect(x.api.start).toHaveBeenCalledTimes(1);
  await r.retry();
  expect(x.api.settle.mock.calls.map((call) => call[2])).toEqual([
    requestId,
    requestId,
  ]);
  expect(r.getState().award?.receipt.result.decision.kind).toBe('no_award');
  await r.clear();
  expect(await x.store.read()).toBeNull();
});

test('transient account refresh retains local Finish while suspending dispatch until authenticated restore', async () => {
  const x = setup(),
    r = x.create();
  await r.begin(ctx, journey);
  r.suspendNetwork();
  await r.finish('arrival');
  const intent = (await x.store.read())?.finish;
  expect(intent).not.toBeNull();
  expect(r.getState().capture?.phase).toBe('finishing');
  expect(x.api.finish).not.toHaveBeenCalled();
  await r.retry();
  expect(x.api.finish).not.toHaveBeenCalled();
  await r.restore(ctx);
  await r.retry();
  expect(x.api.finish).toHaveBeenCalledTimes(1);
  expect(x.api.finish.mock.calls[0]?.[2]).toBe(intent?.requestId);
  expect(x.api.finish.mock.calls[0]?.[4]).toBe(intent?.endedAtMs);
});

test('identity invalidation clears a suspended capture before successor restore and callbacks', async () => {
  const x = setup(),
    r = x.create();
  await r.begin(ctx, journey);
  r.suspendNetwork();
  const invalidating = r.invalidate();
  expect(r.getState().capture).toBeNull();
  await invalidating;
  await r.collect([]);
  await r.finish('arrival');
  await r.restore({
    ...ctx,
    profileId: '00000000-0000-4000-8000-000000000006',
  });
  expect(await x.store.read()).toBeNull();
  expect(x.api.finish).not.toHaveBeenCalled();
});
