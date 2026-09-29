import type { Photo } from './capture';

export type ActivityResult = { kind: 'unavailable'; creditedPoints: 0 };
type Input = {
  photo: Photo;
  description: string;
  bus: { start: string; destination: string } | null;
};

/** A single transient attempt. Cancel/unmount invalidates late replies and releases media. */
export function createActivityAttempt(
  send?: (input: Input, signal: AbortSignal) => Promise<ActivityResult>,
) {
  let pending: { controller: AbortController; input: Input } | undefined;
  return {
    cancel() {
      if (!pending) return;
      pending.controller.abort();
      pending.input.photo.base64 = '';
      pending.input.description = '';
      pending.input.bus = null;
      pending = undefined;
    },
    async submit(
      input: Input,
      currentSend = send,
    ): Promise<ActivityResult | null> {
      if (!currentSend) throw new Error('Activity check is unavailable.');
      if (pending) throw new Error('An activity check is already in progress.');
      const current = { controller: new AbortController(), input };
      pending = current;
      const stopped = new Promise<null>((resolve) => {
        current.controller.signal.addEventListener(
          'abort',
          () => resolve(null),
          { once: true },
        );
      });
      const timeout = setTimeout(() => current.controller.abort(), 20_000);
      try {
        const result = await Promise.race([
          currentSend(input, current.controller.signal),
          stopped,
        ]);
        return current.controller.signal.aborted ? null : result;
      } finally {
        clearTimeout(timeout);
        input.photo.base64 = '';
        input.description = '';
        input.bus = null;
        if (pending === current) pending = undefined;
      }
    },
  };
}
