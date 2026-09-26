import { expect, test } from '@jest/globals';
import { parseStoredSession } from './stored-session';
const provider = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: 123456,
  subject: '11111111-1111-4111-8111-111111111111',
};
test('legacy session stays byte-compatible in shape; provider data survives active and revoking storage', () => {
  const legacy = { kind: 'active', token: 'old', selected: 'demo' };
  expect(parseStoredSession(JSON.stringify(legacy))).toEqual(legacy);
  for (const stored of [
    { ...legacy, provider },
    { kind: 'revoking', token: 'old', provider },
  ])
    expect(parseStoredSession(JSON.stringify(stored))).toEqual(stored);
});
test('malformed provider credentials fail closed without silently restoring app authority', () => {
  for (const value of [
    { kind: 'active', token: 'old', selected: 'real', provider: {} },
    {
      kind: 'active',
      token: 'old',
      selected: 'real',
      provider: { ...provider, expiresAt: -1 },
    },
  ])
    expect(() => parseStoredSession(JSON.stringify(value))).toThrow();
});
