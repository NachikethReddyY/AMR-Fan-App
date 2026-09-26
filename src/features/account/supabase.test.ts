/** @jest-environment node */
import { expect, jest, test } from '@jest/globals';
import { createSupabaseAuth, type ProviderSession } from './supabase';
const origin = 'https://folakoxsilrfemctvlxj.supabase.co';
const config = async () => ({
  auth: {
    mode: 'supabase',
    url: origin,
    publishableKey: 'sb_publishable_synthetic_fixture_only',
  },
});
const signed = {
  access_token: 'synthetic.jwt.value',
  refresh_token: 'synthetic-refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: '11111111-1111-4111-8111-111111111111' },
};
function fixture(value: unknown = signed, status = 200) {
  const request = jest.fn<typeof fetch>(
    async () => new Response(JSON.stringify(value), { status }),
  );
  return {
    request,
    auth: createSupabaseAuth({ config, request, now: () => 1000 }),
  };
}
test('password goes only to fixed provider; response is parsed without roles or metadata', async () => {
  const { auth, request } = fixture();
  expect(await auth.signIn(' fan@example.test ', 'synthetic-password')).toEqual(
    {
      accessToken: signed.access_token,
      refreshToken: signed.refresh_token,
      expiresAt: 3601000,
      subject: signed.user.id,
    },
  );
  expect(request.mock.calls[0][0]).toBe(
    `${origin}/auth/v1/token?grant_type=password`,
  );
  expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({
    email: 'fan@example.test',
    password: 'synthetic-password',
  });
});
test('signup confirmation never grants a session; automatic confirmation handles token response', async () => {
  expect(
    await fixture({ id: signed.user.id }).auth.signUp(
      'fan@example.test',
      'synthetic-password',
    ),
  ).toEqual({ kind: 'confirmation' });
  expect(
    (await fixture().auth.signUp('fan@example.test', 'synthetic-password'))
      .kind,
  ).toBe('session');
});
test('invalid email/password, config, foreign provider and secret key fail before request', async () => {
  const { auth, request } = fixture();
  await expect(auth.signIn('invalid', 'x')).rejects.toThrow('email');
  await expect(auth.signIn('a@b.test', '')).rejects.toThrow('password');
  for (const authConfig of [
    { mode: 'unavailable' },
    {
      mode: 'supabase',
      url: 'https://other.supabase.co',
      publishableKey: 'sb_publishable_synthetic_fixture_only',
    },
    {
      mode: 'supabase',
      url: origin,
      publishableKey: 'sb_secret_never_allowed',
    },
  ]) {
    await expect(
      createSupabaseAuth({
        config: async () => ({ auth: authConfig }),
        request,
      }).signIn('a@b.test', 'x'),
    ).rejects.toThrow();
  }
  expect(request).not.toHaveBeenCalled();
});
test('provider failures are controlled, confirmation and rate-limit explain the next step', async () => {
  await expect(
    fixture(
      { error_code: 'invalid_credentials', message: 'SECRET' },
      400,
    ).auth.signIn('a@b.test', 'x'),
  ).rejects.toThrow('Check your email and password');
  await expect(
    fixture({ error_code: 'email_not_confirmed' }, 400).auth.signIn(
      'a@b.test',
      'x',
    ),
  ).rejects.toThrow('Confirm your email');
  await expect(fixture({}, 429).auth.signIn('a@b.test', 'x')).rejects.toThrow(
    'Wait',
  );
});
test('refresh rotation keeps same identity; foreign identity and malformed/oversized response fail', async () => {
  const old: ProviderSession = {
    accessToken: 'old',
    refreshToken: 'old-refresh',
    expiresAt: 0,
    subject: signed.user.id,
  };
  const { auth, request } = fixture();
  expect((await auth.refresh(old)).refreshToken).toBe(signed.refresh_token);
  expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({
    refresh_token: 'old-refresh',
  });
  await expect(
    fixture({
      ...signed,
      user: { id: '22222222-2222-4222-8222-222222222222' },
    }).auth.refresh(old),
  ).rejects.toThrow();
  for (const data of [
    {},
    { ...signed, expires_in: NaN },
    { ...signed, access_token: 'x'.repeat(16385) },
  ])
    await expect(fixture(data).auth.signIn('a@b.test', 'x')).rejects.toThrow();
  await expect(
    fixture({ padding: 'x'.repeat(65537) }).auth.signIn('a@b.test', 'x'),
  ).rejects.toThrow();
});
test('logout revokes only the current provider session', async () => {
  const { auth, request } = fixture();
  await auth.revoke({
    accessToken: 'old',
    refreshToken: 'r',
    expiresAt: 99999,
    subject: signed.user.id,
  });
  expect(request.mock.calls[0][0]).toBe(`${origin}/auth/v1/logout?scope=local`);
  expect(request.mock.calls[0][1]?.headers).toMatchObject({
    Authorization: 'Bearer old',
  });
});
test('fixture transport cannot be configured outside development or to a remote origin', () => {
  for (const fixtureUrl of ['http://127.0.0.1:1234', 'https://remote.example'])
    expect(() =>
      createSupabaseAuth({ config, fixtureUrl, development: false }),
    ).toThrow();
  expect(() =>
    createSupabaseAuth({
      config,
      fixtureUrl: 'https://remote.example',
      development: true,
    }),
  ).toThrow();
});
test('validated public configuration lets provider logout proceed when the app API later goes offline', async () => {
  const configuration = jest.fn(config);
  const { request } = fixture();
  const auth = createSupabaseAuth({
    config: configuration,
    request,
    now: () => 1000,
  });
  const session = await auth.signIn('fan@example.test', 'synthetic');
  configuration.mockRejectedValue(new Error('app API offline'));
  await auth.revoke(session);
  expect(request.mock.calls.at(-1)?.[0]).toBe(
    `${origin}/auth/v1/logout?scope=local`,
  );
  expect(configuration).toHaveBeenCalledTimes(1);
});
