/** @jest-environment node */
import { expect, jest, test } from '@jest/globals';
import { createEmailFlow } from './email-flow';
import { createSupabaseAuth, supabaseOrigin } from './supabase';
import type { Session } from './api';
import { createSessionController } from './session';
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
test('a confirmation-only signup offers a conditional email next step without claiming delivery', async () => {
  const { flow, api, request } = setup({ id: providerResponse.user.id });
  await expect(
    flow.authenticate('signUp', 'fan@example.test', 'fixture-password'),
  ).rejects.toThrow(
    new Error(
      'Check your email. If you received a confirmation link, open it, then return here to sign in.',
    ),
  );
  expect(request).toHaveBeenCalledTimes(1);
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

test.each(['code', 'error_code'])(
  'unconfirmed sign-in (%s) offers an email next step without starting code confirmation',
  async (field) => {
    const { flow, api, request } = setup(
      { [field]: 'email_not_confirmed' },
      400,
    );
    await expect(
      flow.authenticate('signIn', 'fan@example.test', 'fixture-password'),
    ).rejects.toThrow(
      new Error(
        'Check your email. If you received a confirmation link, open it, then return here to sign in.',
      ),
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(api.signIn).not.toHaveBeenCalled();
  },
);

// A sanitized duplicate user and a new unconfirmed user have the same authority.
test.each([{}, { identities: [], confirmation_sent_at: '2030-01-01' }])(
  'confirmation-only signup stays signed out with no storage, exchange or resend (%j)',
  async (extra) => {
    const { flow, api, request } = setup({
      id: providerResponse.user.id,
      ...extra,
    });
    const write = jest.fn(async () => {});
    const controller = createSessionController(
      {
        ...api,
        resume: async () => session.account,
        logout: async () => {},
        syntheticSignIn: async () => session,
        rename: async () => {
          throw new Error('unused');
        },
        history: async () => {
          throw new Error('unused');
        },
      },
      { read: async () => null, write, clear: async () => {} },
    );
    await controller.signIn(() =>
      flow.authenticate('signUp', 'fan@example.test', 'fixture-password'),
    );
    expect(controller.getState()).toEqual({
      kind: 'signedOut',
      error:
        'Check your email. If you received a confirmation link, open it, then return here to sign in.',
    });
    expect(api.signIn).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);
  },
);
