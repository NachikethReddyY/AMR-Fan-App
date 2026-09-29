import { AccountError } from '../account/api.ts';
import type { HistoryPage } from './contracts.ts';

type Context = { token: string; profileId: string };
export type HistoryState =
  | { kind: 'idle' }
  | { kind: 'loading'; profileId: string }
  | { kind: 'unavailable'; profileId: string; message: string }
  | {
      kind: 'ready';
      profileId: string;
      page: HistoryPage;
      loadingMore: boolean;
      error: string | null;
    };
type ReadHistory = (
  token: string,
  profileId: string,
  before?: string,
) => Promise<HistoryPage>;
export function createHistoryController(
  read: ReadHistory,
  expired: (token: string) => void | Promise<void>,
) {
  let context: Context | null = null;
  let state: HistoryState = { kind: 'idle' };
  let generation = 0;
  let pending: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  function set(next: HistoryState) {
    state = next;
    listeners.forEach((listener) => listener());
  }
  function fetchPage(more: boolean): Promise<void> {
    if (!context) return Promise.resolve();
    if (pending) return pending;
    const current = context;
    const previous = state.kind === 'ready' ? state : null;
    const before = more ? previous?.page.nextCursor : undefined;
    if (more && !before) return Promise.resolve();
    const attempt = generation;
    set(
      more && previous
        ? { ...previous, loadingMore: true, error: null }
        : { kind: 'loading', profileId: current.profileId },
    );
    const request = (async () => {
      try {
        const page = await read(
          current.token,
          current.profileId,
          before ?? undefined,
        );
        if (attempt !== generation) return;
        if (more && previous) {
          const ids = new Set(previous.page.entries.map((entry) => entry.id));
          if (
            page.entries.some((entry) => ids.has(entry.id)) ||
            page.nextCursor === before
          )
            throw new Error('Invalid History continuation.');
          page.entries = [...previous.page.entries, ...page.entries];
        }
        set({
          kind: 'ready',
          profileId: current.profileId,
          page,
          loadingMore: false,
          error: null,
        });
      } catch (error) {
        if (attempt !== generation) return;
        if (error instanceof AccountError && error.status === 401) {
          set({ kind: 'idle' });
          await expired(current.token);
        } else if (
          more &&
          previous &&
          !(error instanceof AccountError && error.status === 404)
        ) {
          set({
            ...previous,
            loadingMore: false,
            error: 'Could not load more History. Retry.',
          });
        } else
          set({
            kind: 'unavailable',
            profileId: current.profileId,
            message: 'Balance and History are unavailable. Retry.',
          });
      } finally {
        if (attempt === generation) pending = null;
      }
    })();
    pending = request;
    return request;
  }
  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setContext: (next: Context | null) => {
      if (
        next?.token === context?.token &&
        next?.profileId === context?.profileId
      )
        return pending ?? Promise.resolve();
      ++generation;
      pending = null;
      context = next;
      set({ kind: 'idle' });
      return next ? fetchPage(false) : Promise.resolve();
    },
    refresh: () => {
      if (state.kind === 'loading') return pending ?? Promise.resolve();
      ++generation;
      pending = null;
      return fetchPage(false);
    },
    loadMore: () => fetchPage(true),
  };
}
