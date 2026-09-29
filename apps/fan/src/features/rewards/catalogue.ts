import type { Page, ResourceState } from '../account/resource';
import type { Offer } from './contracts';

// Guest lifecycle is independent of authenticated profile resources.
export function createCatalogue(
  read: (cursor?: string) => Promise<Page<Offer>>,
) {
  let active = false;
  let generation = 0;
  let state: ResourceState<Offer> = { kind: 'idle' };
  const listeners = new Set<() => void>();
  function set(next: ResourceState<Offer>) {
    state = next;
    listeners.forEach((listener) => listener());
  }
  async function load(more: boolean) {
    if (
      !active ||
      state.kind === 'loading' ||
      (state.kind === 'ready' && state.busy)
    )
      return;
    const previous = state.kind === 'ready' ? state : null;
    const cursor = more ? previous?.nextCursor : undefined;
    if (more && !cursor) return;
    const attempt = generation;
    set(
      more && previous
        ? { ...previous, busy: true, error: null }
        : { kind: 'loading' },
    );
    try {
      const page = await read(cursor ?? undefined);
      if (attempt !== generation) return;
      const items =
        more && previous ? [...previous.items, ...page.items] : page.items;
      if (
        new Set(items.map((item) => item.id)).size !== items.length ||
        (cursor && page.nextCursor === cursor)
      )
        throw new Error('Invalid catalogue continuation');
      set({ kind: 'ready', ...page, items, busy: false, error: null });
    } catch {
      if (attempt !== generation) return;
      set(
        more && previous
          ? {
              ...previous,
              busy: false,
              error: 'Could not load more offers. Retry.',
            }
          : { kind: 'error', error: 'Offers unavailable. Retry.' },
      );
    }
  }
  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start: async () => {
      if (active) return;
      active = true;
      ++generation;
      set({ kind: 'idle' });
      await load(false);
    },
    stop: () => {
      active = false;
      ++generation;
      set({ kind: 'idle' });
    },
    refresh: () => load(false),
    more: () => load(true),
  };
}
