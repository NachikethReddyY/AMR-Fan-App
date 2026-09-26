import { AccountError } from './api.ts';
export type Context = { token: string; profileId: string };
export type Page<T> = { items: T[]; nextCursor: string | null };
export type ResourceState<T> =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; error: string }
  | {
      kind: 'ready';
      items: T[];
      nextCursor: string | null;
      busy: boolean;
      error: string | null;
    };
export function createResource<T extends { id: string }>(
  read: (context: Context, cursor?: string) => Promise<Page<T>>,
  expired: (token: string) => void | Promise<void>,
) {
  let context: Context | null = null;
  let version = 0;
  let state: ResourceState<T> = { kind: 'idle' };
  const listeners = new Set<() => void>();
  function set(next: ResourceState<T>) {
    state = next;
    listeners.forEach((fn) => fn());
  }
  async function load(more: boolean) {
    if (
      !context ||
      state.kind === 'loading' ||
      (state.kind === 'ready' && state.busy)
    )
      return;
    const previous = state.kind === 'ready' ? state : null;
    const cursor = more ? previous?.nextCursor : undefined;
    if (more && !cursor) return;
    const current = context;
    const attempt = version;
    set(
      more && previous
        ? { ...previous, busy: true, error: null }
        : { kind: 'loading' },
    );
    try {
      const page = await read(current, cursor ?? undefined);
      if (attempt !== version) return;
      const items =
        more && previous ? [...previous.items, ...page.items] : page.items;
      if (
        new Set(items.map((item) => item.id)).size !== items.length ||
        (cursor && page.nextCursor === cursor)
      )
        throw new Error('Invalid continuation');
      set({ kind: 'ready', ...page, items, busy: false, error: null });
    } catch (error) {
      if (attempt !== version) return;
      if (error instanceof AccountError && error.status === 401) {
        set({ kind: 'idle' });
        await expired(current.token);
      } else
        set(
          more && previous
            ? { ...previous, busy: false, error: 'Could not load more. Retry.' }
            : { kind: 'error', error: 'Data unavailable. Retry.' },
        );
    }
  }
  return {
    getState: () => state,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    setContext: async (next: Context | null) => {
      if (
        next?.token === context?.token &&
        next?.profileId === context?.profileId
      )
        return;
      ++version;
      context = next;
      set({ kind: 'idle' });
      if (next) await load(false);
    },
    refresh: () => load(false),
    more: () => load(true),
  };
}
export type IntentStorage = {
  read: (key: string) => Promise<string | null>;
  write: (key: string, value: string) => Promise<void>;
  clear: (key: string) => Promise<void>;
};
// Shared only for this storage adapter: old unmounted screens cannot delete a
// later confirmation while a new screen writes it.
const storageQueues = new WeakMap<IntentStorage, Promise<void>>();
function withIntentStorage<T>(storage: IntentStorage, fn: () => Promise<T>) {
  const result = (storageQueues.get(storage) ?? Promise.resolve()).then(fn);
  storageQueues.set(
    storage,
    result.then(
      () => {},
      () => {},
    ),
  );
  return result;
}
export type IntentState<I, R> =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'retry'; input: I; error: string }
  | { kind: 'rejected'; error: string }
  | { kind: 'success'; result: R };
// A single pending paid intent per feature/profile survives a lost response.
// A new controller must recover it before accepting another confirmation.
export function createIntent<I, R>({
  name,
  storage,
  parse,
  execute,
  expired,
}: {
  name: string;
  storage: IntentStorage;
  parse: (raw: unknown) => I;
  execute: (context: Context, input: I) => Promise<R>;
  expired: (token: string) => void | Promise<void>;
}) {
  let context: Context | null = null;
  let version = 0;
  let state: IntentState<I, R> = { kind: 'idle' };
  let queue = Promise.resolve();
  let recovered = false;
  const listeners = new Set<() => void>();
  function set(next: IntentState<I, R>) {
    state = next;
    listeners.forEach((fn) => fn());
  }
  function key(ctx: Context) {
    return `amr.intent.${name}.${ctx.profileId}`;
  }
  function serial<T>(fn: () => Promise<T>) {
    const result = queue.then(fn);
    queue = result.then(
      () => {},
      () => {},
    );
    return result;
  }
  async function run(input: I, saved: boolean) {
    if (!context || !recovered || state.kind === 'loading') return;
    const current = context;
    const attempt = version;
    const encoded = JSON.stringify(input);
    async function clearMatching() {
      await withIntentStorage(storage, async () => {
        if ((await storage.read(key(current))) === encoded)
          await storage.clear(key(current));
      });
    }
    set({ kind: 'loading' });
    await serial(async () => {
      if (attempt !== version) return;
      let persisted = saved;
      try {
        if (!saved) {
          const existing = await withIntentStorage(storage, async () => {
            const raw = await storage.read(key(current));
            if (raw !== null) return parse(JSON.parse(raw));
            await storage.write(key(current), encoded);
            return null;
          });
          if (existing !== null) {
            if (attempt === version)
              set({
                kind: 'retry',
                input: existing,
                error: 'An earlier confirmation needs its result checked.',
              });
            return;
          }
          persisted = true;
        }
        if (attempt !== version) return;
        const result = await execute(current, input);
        await clearMatching();
        if (attempt === version) set({ kind: 'success', result });
      } catch (error) {
        const definitive =
          error instanceof AccountError &&
          [400, 403, 404, 409, 422].includes(error.status);
        if (definitive) await clearMatching();
        if (attempt !== version) return;
        if (error instanceof AccountError && error.status === 401) {
          recovered = false;
          set({ kind: 'idle' });
          await expired(current.token);
        } else if (definitive)
          set({
            kind: 'rejected',
            error:
              error.status === 409
                ? 'Request declined. Refresh current details and confirm again.'
                : 'Request declined. Check the details and balance.',
          });
        else if (persisted)
          set({
            kind: 'retry',
            input,
            error:
              'Confirmation not received. Retry this same request to check its result.',
          });
        else {
          recovered = false;
          set({
            kind: 'rejected',
            error:
              'Confirmation storage unavailable. Reopen this screen before continuing.',
          });
        }
      }
    });
  }
  return {
    getState: () => state,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    setContext: async (next: Context | null) => {
      if (
        next?.token === context?.token &&
        next?.profileId === context?.profileId
      )
        return;
      const attempt = ++version;
      context = next;
      recovered = false;
      set(next ? { kind: 'loading' } : { kind: 'idle' });
      if (!next) return;
      await serial(async () => {
        if (attempt !== version) return;
        try {
          const raw = await withIntentStorage(storage, () =>
            storage.read(key(next)),
          );
          const input = raw === null ? null : parse(JSON.parse(raw));
          if (attempt === version) {
            recovered = true;
            set(
              input === null
                ? { kind: 'idle' }
                : {
                    kind: 'retry',
                    input,
                    error:
                      'An earlier confirmation needs its result checked. Retry the same request.',
                  },
            );
          }
        } catch {
          if (attempt === version)
            set({
              kind: 'rejected',
              error:
                'Saved confirmation unavailable. Reopen this screen before continuing.',
            });
        }
      });
    },
    submit: (input: I) =>
      state.kind === 'retry' ? Promise.resolve() : run(input, false),
    retry: () =>
      state.kind === 'retry' ? run(state.input, true) : Promise.resolve(),
  };
}
