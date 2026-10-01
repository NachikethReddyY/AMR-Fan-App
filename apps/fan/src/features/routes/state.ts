import { AccountError } from '../account/api.ts';
import type { Context } from '../account/resource.ts';
import type { Comparison, TravelQuery } from './api.ts';
type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; value: Comparison; selectedId: string | null };
export function createTravelController(
  read: (ctx: Context, query: TravelQuery) => Promise<Comparison>,
  expired: (token: string) => void | Promise<void>,
) {
  let version = 0;
  let state: State = { kind: 'idle' };
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
      ++version;
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
      const attempt = ++version;
      set({ kind: 'loading' });
      try {
        const value = await read(ctx, query);
        if (attempt === version)
          set({ kind: 'ready', value, selectedId: null });
      } catch (e) {
        if (attempt !== version) return;
        if (e instanceof AccountError && e.status === 401) {
          set({ kind: 'idle' });
          await expired(ctx.token);
        } else
          set({
            kind: 'error',
            message:
              e instanceof AccountError && e.status === 429
                ? 'Comparison limit reached. Retry shortly.'
                : 'Routes unavailable. Check the places and retry.',
          });
      }
    },
  };
}
