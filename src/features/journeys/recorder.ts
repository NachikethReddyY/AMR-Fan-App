import { z } from 'zod';
import { AccountError } from '../account/api';
import type { Context } from '../account/resource';
import type { JourneyApi } from './api';
import {
  journeySchema,
  sampleSchema,
  finishReason,
  type Journey,
  type Sample,
  type FinishReason,
  type Award,
} from './contracts';

const intent = z.object({
  requestId: z.string(),
  endedAtMs: z.number(),
  reason: finishReason,
});
export const captureSchema = z.object({
  journey: journeySchema,
  selection: z
    .object({
      modes: z.array(journeySchema.shape.mode).max(128).optional(),
      origin: z.string().max(200),
      destination: z.string().max(200),
      distanceMeters: z.number().nonnegative().nullable(),
      durationSeconds: z.number().nonnegative().nullable(),
    })
    .optional(),
  captureSessionId: z.string(),
  startRequestId: z.string(),
  phase: z.enum(['starting', 'active', 'finishing', 'finished']),
  samples: z.array(sampleSchema).max(4096),
  sentCount: z.number().int().nonnegative().max(4096),
  batch: z
    .object({
      requestId: z.string(),
      samples: z.array(sampleSchema).min(1).max(50),
    })
    .nullable(),
  finish: intent.nullable(),
  settlement: z
    .object({
      requestId: z.string(),
      version: z.string(),
      revision: z.number(),
    })
    .nullable(),
});
export type StoredCapture = z.infer<typeof captureSchema>;
export type CaptureStore = {
  read: () => Promise<StoredCapture | null>;
  write: (value: StoredCapture | null) => Promise<void>;
};
type RecorderApi = Pick<
  JourneyApi,
  'start' | 'read' | 'evidence' | 'finish' | 'settle'
>;
export type LocationDriver = {
  permission: () => Promise<boolean>;
  isRunning: () => Promise<boolean>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};
export function createRecorder({
  api,
  store,
  location,
  uuid,
  now,
  onExpired,
}: {
  api: RecorderApi;
  store: CaptureStore;
  location: LocationDriver;
  uuid: () => string;
  now: () => number;
  onExpired: (token: string) => void | Promise<void>;
}) {
  let ctx: Context | null = null,
    epoch = 0;
  let cutoff: number | null = null;
  let invalidated = false;
  let state: {
    capture: StoredCapture | null;
    award: Award | null;
    busy: boolean;
    collecting: boolean;
    message: string | null;
  } = {
    capture: null,
    award: null,
    busy: false,
    collecting: false,
    message: null,
  };
  let queue = Promise.resolve();
  const listeners = new Set<() => void>();
  const set = (next: Partial<typeof state>) => {
    state = { ...state, ...next };
    listeners.forEach((f) => f());
  };
  function serial<T>(run: () => Promise<T>): Promise<T> {
    const p = queue.then(run);
    queue = p.then(
      () => {},
      () => {},
    );
    return p;
  }
  const save = async (c: StoredCapture | null) => {
    await store.write(c);
    set({ capture: c });
  };
  async function failure(error: unknown, token?: string) {
    if (error instanceof AccountError && error.status === 401 && token) {
      await location.stop();
      await serial(() => save(null));
      set({
        collecting: false,
        message: 'Sign in again to resume your journey.',
      });
      await onExpired(token);
    } else
      set({
        message:
          error instanceof AccountError && error.status === 409
            ? 'Journey changed on the server. Refresh it before continuing.'
            : 'Could not sync your journey. Saved data is kept; retry when connected.',
      });
  }
  async function sync(attempt: number) {
    const context = ctx;
    if (!context) return;
    const valid = () => attempt === epoch && ctx?.token === context.token;
    // Local writes have their own queue. Never hold it across a network request.
    const change = (fn: (c: StoredCapture) => StoredCapture | null) =>
      serial(async () => {
        if (!valid()) return null;
        const current = await store.read();
        if (
          !valid() ||
          !current ||
          current.journey.profileId !== context.profileId
        )
          return null;
        const next = fn(current);
        if (next !== current) await save(next);
        return next;
      });
    let c = await serial(() => store.read());
    if (!valid() || !c || c.journey.profileId !== context.profileId) return;
    try {
      if (c.journey.preciseExpiresAtMs <= now()) {
        await location.stop();
        await change(() => null);
        set({
          collecting: false,
          message: 'Journey recording expired. Plan a new journey.',
        });
        return;
      }
      if (c.finish) await location.stop();
      if (!valid()) return;
      if (c.phase === 'starting') {
        const journey = c.finish
          ? await api.read(context, c.journey.id)
          : await api.start(
              context,
              c.journey.id,
              c.startRequestId,
              c.captureSessionId,
            );
        if (!valid()) return;
        if (c.finish && journey.state === 'prepared') {
          await change(() => null);
          set({
            collecting: false,
            message: 'Recording stopped before the journey started.',
          });
          return;
        }
        if (
          journey.state !== 'active' ||
          journey.captureSessionId !== c.captureSessionId
        )
          throw new Error('Start acknowledgment mismatch.');
        c = await change((current) => ({
          ...current,
          journey,
          phase: current.finish ? 'finishing' : 'active',
        }));
        if (!valid() || !c) return;
        if (c.phase === 'active' && cutoff === null) {
          if (!(await location.permission())) {
            set({ message: 'Allow location access to resume recording.' });
            return;
          }
          if (!valid() || cutoff !== null) return;
          await location.start();
          if (!valid() || cutoff !== null) {
            await location.stop();
            if (!valid()) return;
          } else set({ collecting: true });
        }
      }
      while (valid()) {
        c = await change((current) =>
          current.batch || current.samples.length === 0
            ? current
            : {
                ...current,
                batch: {
                  requestId: uuid(),
                  samples: current.samples.slice(0, 50),
                },
              },
        );
        if (!c || !c.batch) break;
        const batch = c.batch;
        await api.evidence(
          context,
          c.journey.id,
          batch.requestId,
          c.captureSessionId,
          batch.samples,
        );
        if (!valid()) return;
        const ids = new Set(batch.samples.map((s) => s.id));
        c = await change((current) => ({
          ...current,
          batch: null,
          samples: current.samples.filter((s) => !ids.has(s.id)),
          sentCount: current.sentCount + batch.samples.length,
        }));
      }
      if (!valid() || !c) return;
      if (c.phase === 'finishing' && c.finish) {
        await location.stop();
        const end = c.finish;
        const journey = await api.finish(
          context,
          c.journey.id,
          end.requestId,
          c.captureSessionId,
          end.endedAtMs,
          end.reason,
        );
        if (!valid()) return;
        c = await change((current) => ({
          ...current,
          journey,
          phase: 'finished',
        }));
      }
      if (!valid() || !c) return;
      if (c.phase === 'finished') {
        const journey = await api.read(context, c.journey.id);
        if (!valid()) return;
        c = await change((current) => ({
          ...current,
          journey,
          settlement:
            current.settlement?.revision === journey.assessment.revision &&
            current.settlement.version === journey.assessment.version
              ? current.settlement
              : {
                  requestId: uuid(),
                  version: journey.assessment.version,
                  revision: journey.assessment.revision,
                },
        }));
        if (!valid() || !c?.settlement) return;
        const award = await api.settle(
          context,
          c.journey.id,
          c.settlement.requestId,
          c.settlement.version,
          c.settlement.revision,
        );
        if (!valid()) return;
        set({ award });
      }
      set({ message: null });
    } catch (error) {
      if (valid()) await failure(error, context.token);
    }
  }
  let networkQueue = Promise.resolve();
  let identityCleanup = Promise.resolve();
  async function run(action: () => Promise<void>) {
    const requestedEpoch = epoch;
    const pending = networkQueue.then(async () => {
      try {
        await identityCleanup;
        if (requestedEpoch !== epoch) return;
        set({ busy: true });
        await action();
      } catch (e) {
        await failure(e, ctx?.token);
      } finally {
        set({ busy: false });
      }
    });
    networkQueue = pending.catch(() => {});
    return pending;
  }
  return {
    getState: () => state,
    // Keep the local capture available to Stop while account authority refreshes.
    suspendNetwork: () => {
      ++epoch;
      ctx = null;
    },
    subscribe: (f: () => void) => {
      listeners.add(f);
      return () => {
        listeners.delete(f);
      };
    },
    restore: async (context: Context) =>
      run(() =>
        serial(async () => {
          ctx = context;
          invalidated = false;
          const c = await store.read();
          if (
            c &&
            (c.journey.profileId !== context.profileId ||
              c.journey.preciseExpiresAtMs <= now())
          ) {
            await location.stop();
            await save(null);
            set({ collecting: false });
          } else {
            cutoff = c?.finish?.endedAtMs ?? null;
            set({
              capture: c,
              collecting: c?.phase === 'active' && (await location.isRunning()),
            });
          }
        }),
      ),
    begin: async (
      context: Context,
      journey: Journey,
      selection?: StoredCapture['selection'],
    ) =>
      run(async () => {
        if (
          state.capture &&
          (state.capture.phase !== 'finished' ||
            state.award?.receipt.journeyId !== state.capture.journey.id)
        )
          return;
        const attempt = ++epoch;
        ctx = context;
        invalidated = false;
        cutoff = null;
        if (
          journey.profileId !== context.profileId ||
          journey.state !== 'prepared'
        )
          throw new Error('Invalid selected journey.');
        if (!(await location.permission())) {
          set({
            message:
              'Location access is required to record a journey. You can still compare routes.',
          });
          return;
        }
        if (attempt !== epoch) return;
        await serial(() =>
          save({
            journey,
            selection,
            captureSessionId: uuid(),
            startRequestId: uuid(),
            phase: 'starting',
            samples: [],
            sentCount: 0,
            batch: null,
            finish: null,
            settlement: null,
          }),
        );
        set({ award: null });
        await sync(attempt);
      }),
    // The OS task calls this without session credentials. It only persists original samples.
    collect: async (samples: Sample[]) =>
      serial(async () => {
        if (invalidated) return;
        const c = await store.read();
        if (!c || c.phase !== 'active' || c.journey.startedAtMs === null)
          return;
        if (c.journey.preciseExpiresAtMs <= now()) {
          await location.stop();
          await save(null);
          set({ collecting: false });
          return;
        }
        const known = new Set(c.samples.map((s) => s.id));
        const startedAtMs = c.journey.startedAtMs;
        const accepted = samples.filter((s) => {
          if (
            s.acquiredAtMs < startedAtMs ||
            s.acquiredAtMs > now() ||
            (cutoff !== null && s.acquiredAtMs > cutoff) ||
            s.receivedAtMs < s.acquiredAtMs ||
            known.has(s.id)
          )
            return false;
          known.add(s.id);
          return true;
        });
        const remaining = 4096 - c.sentCount - c.samples.length;
        if (accepted.length > remaining) {
          await location.stop();
          await save({
            ...c,
            phase: 'finishing',
            finish: {
              requestId: uuid(),
              endedAtMs: now(),
              reason: 'interrupted',
            },
          });
          set({
            collecting: false,
            message: 'Recording limit reached. Sync to finish this journey.',
          });
          return;
        }
        await save({ ...c, samples: [...c.samples, ...accepted] });
      }),
    refreshStatus: async () =>
      run(async () => {
        const c = state.capture;
        if (c?.phase === 'active')
          set({ collecting: await location.isRunning() });
      }),
    retry: async () => run(() => sync(epoch)),
    resume: async (context: Context, journey?: Journey) =>
      run(async () => {
        ctx = context;
        invalidated = false;
        cutoff = null;
        const attempt = ++epoch;
        let c = state.capture;
        if (
          !c &&
          journey?.state === 'active' &&
          journey.profileId === context.profileId &&
          journey.captureSessionId
        ) {
          c = {
            journey,
            captureSessionId: journey.captureSessionId,
            startRequestId: uuid(),
            phase: 'active',
            samples: [],
            sentCount: journey.assessment.sampleCount,
            batch: null,
            finish: null,
            settlement: null,
          };
          await serial(() => save(c));
        }
        if (!c || c.phase !== 'active') {
          await sync(attempt);
          return;
        }
        const fresh = await api.read(context, c.journey.id);
        if (attempt !== epoch) return;
        if (
          fresh.state !== 'active' ||
          fresh.captureSessionId !== c.captureSessionId ||
          fresh.preciseExpiresAtMs <= now()
        ) {
          await location.stop();
          await serial(() => save(null));
          set({
            collecting: false,
            message: 'This journey can no longer record. Refresh its result.',
          });
          return;
        }
        if (!(await location.permission())) {
          set({
            message: 'Allow location access in Settings before resuming.',
          });
          return;
        }
        if (attempt !== epoch) return;
        await location.start();
        if (attempt !== epoch || cutoff !== null) {
          await location.stop();
          return;
        }
        set({ collecting: true });
        await sync(attempt);
      }),
    finish: async (reason: FinishReason) => {
      const endedAtMs = cutoff ?? now();
      cutoff = endedAtMs;
      set({ collecting: false });
      // Start the native stop immediately, while persisting independently of uploads.
      const stopped = location.stop().catch(() => {});
      await serial(async () => {
        const c = await store.read();
        if (!c || c.phase === 'finished' || invalidated) return;
        if (!c.finish)
          await save({
            ...c,
            phase: c.phase === 'starting' ? 'starting' : 'finishing',
            finish: { requestId: uuid(), endedAtMs, reason },
          });
      });
      await stopped;
      return run(() => sync(epoch));
    },
    // Headless task failure has no authority to settle or upload.
    interrupt: async (reason: FinishReason) => {
      const endedAtMs = cutoff ?? now();
      cutoff = endedAtMs;
      set({ collecting: false });
      const stopped = location.stop().catch(() => {});
      await serial(async () => {
        const c = await store.read();
        if (!c || c.phase !== 'active' || invalidated) return;
        await save({
          ...c,
          phase: 'finishing',
          finish: { requestId: uuid(), endedAtMs, reason },
        });
      });
      await stopped;
    },
    invalidate: async () => {
      ++epoch;
      ctx = null;
      invalidated = true;
      cutoff = now();
      set({ collecting: false, capture: null, award: null, message: null });
      // Reserve cleanup before yielding. Successor restore/Start cannot adopt
      // old data or create a new key until this stop and deletion finish.
      identityCleanup = serial(async () => {
        try {
          await location.stop();
        } finally {
          await save(null);
        }
      });
      await identityCleanup.catch((error: unknown) => failure(error));
    },
    clear: async () =>
      run(async () => {
        if (
          state.capture?.phase === 'finished' &&
          state.award?.receipt.journeyId === state.capture.journey.id
        ) {
          await serial(() => save(null));
          set({ award: null, message: null });
        }
      }),
  };
}
export type Recorder = ReturnType<typeof createRecorder>;
