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
    flow: createEmailFlow(auth, api),
    api,
    request,
  };
}
test('password signup exchanges the provider session immediately without a code step', async () => {
  const { flow, api, request } = setup();
  expect(
    await flow.authenticate('signUp', 'fan@example.test', 'fixture-password'),
  ).toMatchObject(session);
  expect(api.signIn).toHaveBeenCalledWith('fixture-access');
  expect(request.mock.calls[0][0]).toBe(`${supabaseOrigin}/auth/v1/signup`);
});
test('password sign-in exchanges only the validated provider session', async () => {
  const { flow, api } = setup();
  expect(
    await flow.authenticate('signIn', 'fan@example.test', 'fixture-password'),
  ).toMatchObject(session);
  expect(api.signIn).toHaveBeenCalledWith('fixture-access');
});
test('a provider still requiring confirmation fails without a code flow or app session', async () => {
  const { flow, api } = setup({ id: providerResponse.user.id });
  await expect(
    flow.authenticate('signUp', 'fan@example.test', 'fixture-password'),
  ).rejects.toThrow('Account creation could not finish');
  expect(api.signIn).not.toHaveBeenCalled();
});
test('failed app exchange revokes the new provider session', async () => {
  const { flow, api, request } = setup();
  api.signIn.mockRejectedValue(new Error('app unavailable'));
  await expect(
    flow.authenticate('signUp', 'fan@example.test', 'fixture-password'),
  ).rejects.toThrow('app unavailable');
  expect(request.mock.calls.at(-1)?.[0]).toBe(
    `${supabaseOrigin}/auth/v1/logout?scope=local`,
  );
});

test('an existing unconfirmed account reports failure without starting code confirmation', async () => {
  const { flow, api } = setup({ error_code: 'email_not_confirmed' }, 400);
  await expect(
    flow.authenticate('signIn', 'fan@example.test', 'fixture-password'),
  ).rejects.toThrow('Sign-in could not finish');
  expect(api.signIn).not.toHaveBeenCalled();
});
