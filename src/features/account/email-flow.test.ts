/** @jest-environment node */
import { expect, jest, test } from '@jest/globals';
import { createEmailFlow } from './email-flow';
import { createSupabaseAuth, supabaseOrigin } from './supabase';
import type { Session } from './api';
const providerResponse = {
  access_token: 'fixture-access',
  refresh_token: 'fixture-refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: '11111111-1111-4111-8111-111111111111' },
};
const session: Session = {
  token: 'app-token',
  expiresAt: '2030-01-01',
  account: { id: 'fan', role: 'fan', profiles: [] },
};
function setup(value: unknown = providerResponse, status = 200) {
  let now = 0;
  const request = jest.fn<typeof fetch>(
    async () => new Response(JSON.stringify(value), { status }),
  );
  const auth = createSupabaseAuth({
    config: async () => ({
      auth: {
        mode: 'supabase',
        url: supabaseOrigin,
        publishableKey: 'sb_publishable_synthetic_fixture_only',
      },
    }),
    request,
  });
  const api = { signIn: jest.fn(async () => session) };
  return {
    flow: createEmailFlow(auth, api, () => now),
    api,
    request,
    advance: () => {
      now += 60_000;
    },
  };
}
test('verification exchanges only validated provider access token for an app session', async () => {
  const { flow, api } = setup();
  expect(await flow.verify('fan@example.test', '12345678')).toMatchObject({
    ...session,
    provider: { accessToken: 'fixture-access' },
  });
  expect(api.signIn).toHaveBeenCalledWith('fixture-access');
});
test('failed app exchange revokes the newly verified provider session', async () => {
  const { flow, api, request } = setup();
  api.signIn.mockRejectedValue(new Error('app unavailable'));
  await expect(flow.verify('fan@example.test', '12345678')).rejects.toThrow(
    'app unavailable',
  );
  expect(request.mock.calls.at(-1)?.[0]).toBe(
    `${supabaseOrigin}/auth/v1/logout?scope=local`,
  );
});
test('unconfirmed password sign-in opens code entry without app exchange or automatic resend', async () => {
  const { flow, api, request } = setup(
    { error_code: 'email_not_confirmed' },
    400,
  );
  expect(
    await flow.authenticate('signIn', ' fan@example.test ', 'fixture-password'),
  ).toEqual({ kind: 'confirmation', email: 'fan@example.test' });
  expect(api.signIn).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(1);
});
test('resend and pending signup create no app session, existing confirmed account keeps password sign-in', async () => {
  const pending = setup({ id: providerResponse.user.id });
  expect(
    await pending.flow.authenticate(
      'signUp',
      'fan@example.test',
      'fixture-password',
    ),
  ).toEqual({ kind: 'confirmation', email: 'fan@example.test' });
  pending.advance();
  expect(await pending.flow.resend('fan@example.test')).toEqual({
    kind: 'confirmation',
    email: 'fan@example.test',
  });
  expect(pending.api.signIn).not.toHaveBeenCalled();
  const confirmed = setup();
  expect(
    await confirmed.flow.authenticate(
      'signIn',
      'fan@example.test',
      'fixture-password',
    ),
  ).toMatchObject(session);
  expect(confirmed.request.mock.calls[0][0]).toBe(
    `${supabaseOrigin}/auth/v1/token?grant_type=password`,
  );
});

test('signup cooldown rejects immediate resend locally and allows it after sixty seconds', async () => {
  const { flow, request, advance } = setup({ id: providerResponse.user.id });
  await flow.authenticate('signUp', 'fan@example.test', 'fixture-password');
  await expect(flow.resend('fan@example.test')).rejects.toThrow(
    'Wait 60 seconds',
  );
  expect(request).toHaveBeenCalledTimes(1);
  advance();
  await flow.resend('fan@example.test');
  expect(request).toHaveBeenCalledTimes(2);
  await expect(flow.resend('fan@example.test')).rejects.toThrow(
    'Wait 60 seconds',
  );
  expect(request).toHaveBeenCalledTimes(2);
});
