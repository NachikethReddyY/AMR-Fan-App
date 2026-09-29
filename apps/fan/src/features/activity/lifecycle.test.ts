import { createActivityAttempt } from './lifecycle';

test('timeout releases media even if transport ignores abort', async () => {
  jest.useFakeTimers();
  try {
    const attempt = createActivityAttempt(() => new Promise(() => {}));
    const input = {
      photo: {
        kind: 'photo' as const,
        base64: 'YWJj',
        mime: 'image/jpeg' as const,
      },
      description: 'Synthetic',
      bus: null,
    };
    const result = attempt.submit(input);
    jest.advanceTimersByTime(20_000);
    expect(await result).toBeNull();
    expect(input.photo.base64).toBe('');
    expect(input.description).toBe('');
  } finally {
    jest.useRealTimers();
  }
});

test('cancel clears sensitive data and ignores late success', async () => {
  let finish:
    ((value: { kind: 'unavailable'; creditedPoints: 0 }) => void) | undefined;
  const attempt = createActivityAttempt(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const input = {
    photo: {
      kind: 'photo' as const,
      base64: 'YWJj',
      mime: 'image/jpeg' as const,
    },
    description: 'Synthetic description',
    bus: null,
  };
  const result = attempt.submit(input);
  await expect(attempt.submit(input)).rejects.toThrow('already');
  attempt.cancel();
  expect(input.photo.base64).toBe('');
  expect(input.description).toBe('');
  finish?.({ kind: 'unavailable', creditedPoints: 0 });
  expect(await result).toBeNull();
});
test('failed request clears media and description', async () => {
  const attempt = createActivityAttempt(async () => {
    throw new Error('offline');
  });
  const input = {
    photo: {
      kind: 'photo' as const,
      base64: 'YWJj',
      mime: 'image/jpeg' as const,
    },
    description: 'Synthetic',
    bus: null,
  };
  await expect(attempt.submit(input)).rejects.toThrow('offline');
  expect(input.photo.base64).toBe('');
  expect(input.description).toBe('');
});
