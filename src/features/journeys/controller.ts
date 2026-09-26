import { AccountError } from '../account/api';
import type { Context } from '../account/resource';
import type { TravelQuery, Comparison } from '../routes/api';
import type { JourneyApi } from './api';
import type { Plan } from './contracts';
export type JourneyComparison = Pick<
  Comparison,
  'result' | 'estimates' | 'recommendation'
>;
function comparison(plan: Plan): JourneyComparison {
  const display = plan.display;
  if (!display?.source)
    return {
      result: {
        kind: 'unavailable',
        reason: plan.kind === 'unavailable' ? plan.reason : 'missing_display',
      },
      estimates: [],
      recommendation: { kind: 'unavailable', reason: 'no_routes' },
    };
  const routes = display.routes.map((r) => ({
    id: r.routeId,
    mode: r.mode,
    availability: r.availability,
    distanceMeters: r.distanceMeters,
    durationSeconds: r.durationSeconds,
    legs: r.legs.map((l) => ({
      ...l,
      description: l.mode.replaceAll('_', ' '),
    })),
  }));
  const rec = display.recommendation;
  const route =
    rec.kind !== 'unavailable'
      ? routes.find((r) => r.id === rec.routeId)
      : undefined;
  return {
    result: { kind: 'routes', source: display.source, routes },
    estimates: display.routes.map((r) => ({
      routeId: r.routeId,
      estimate: r.estimate,
    })),
    recommendation:
      rec.kind !== 'unavailable' && route
        ? { ...rec, route }
        : {
            kind: 'unavailable',
            reason: rec.kind === 'unavailable' ? rec.reason : 'missing_route',
          },
  };
}
type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      plan: Plan;
      value: JourneyComparison;
      selectedId: string | null;
    };
export function createJourneyController(
  prepare: JourneyApi['prepare'],
  uuid: () => string,
  expired: (token: string) => void | Promise<void>,
) {
  let epoch = 0;
  let state: State = { kind: 'idle' };
  let intent: { key: string; requestId: string } | null = null;
  const listeners = new Set<() => void>();
  const set = (next: State) => {
    state = next;
    listeners.forEach((f) => f());
  };
  return {
    getState: () => state,
    subscribe: (f: () => void) => {
      listeners.add(f);
      return () => {
        listeners.delete(f);
      };
    },
    clear: () => {
      ++epoch;
      intent = null;
      set({ kind: 'idle' });
    },
    select: (id: string) => {
      if (
        state.kind === 'ready' &&
        state.value.result.kind === 'routes' &&
        state.value.result.routes.some(
          (r) => r.id === id && r.availability.kind === 'available',
        )
      )
        set({ ...state, selectedId: id });
    },
    compare: async (ctx: Context, query: TravelQuery) => {
      const attempt = ++epoch;
      const key = JSON.stringify([ctx.token, ctx.profileId, query]);
      if (intent?.key !== key) intent = { key, requestId: uuid() };
      set({ kind: 'loading' });
      try {
        const plan = await prepare(ctx, intent.requestId, query);
        if (attempt === epoch) {
          intent = null;
          set({
            kind: 'ready',
            plan,
            value: comparison(plan),
            selectedId: null,
          });
        }
      } catch (e) {
        if (attempt !== epoch) return;
        if (e instanceof AccountError && e.status === 401) {
          set({ kind: 'idle' });
          await expired(ctx.token);
        } else
          set({
            kind: 'error',
            message: 'Routes unavailable. Check the places and retry.',
          });
      }
    },
  };
}
