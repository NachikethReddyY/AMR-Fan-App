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
  ).toEqual({ kind: 'confirmation', email: 'fan@example.test' });
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

test('password network failures reveal no provider details', async () => {
  const request = jest.fn<typeof fetch>(async () => {
    throw new Error('PRIVATE_NETWORK_DETAILS');
  });
  await expect(
    createSupabaseAuth({ config, request }).signIn(
      'fan@example.test',
      'synthetic',
    ),
  ).rejects.toThrow('Account connection unavailable');
});

test('account edits use authenticated user endpoint and preserve pending email separately', async () => {
  const user = {
    id: signed.user.id,
    email: 'old@example.test',
    new_email: 'new@example.test',
    role: 'admin',
  };
  const { auth, request } = fixture(user);
  const session: ProviderSession = {
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: 9999999999999,
    subject: signed.user.id,
  };
  expect(await auth.account.read(session)).toEqual({
    email: 'old@example.test',
    pendingEmail: 'new@example.test',
  });
  expect(request.mock.calls[0][1]?.method).toBe('GET');
  expect(
    await auth.account.update(session, {
      kind: 'email',
      email: ' new@example.test ',
    }),
  ).toEqual({ email: 'old@example.test', pendingEmail: 'new@example.test' });
  const [url, init] = request.mock.calls[1];
  expect(url).toBe(`${origin}/auth/v1/user`);
  expect(init?.method).toBe('PUT');
  expect(init?.headers).toMatchObject({ Authorization: 'Bearer access' });
  expect(JSON.parse(String(init?.body))).toEqual({ email: 'new@example.test' });
});

test('password writes retain provider current-password and reauthentication requirements', async () => {
  const { auth, request } = fixture({
    id: signed.user.id,
    email: 'fan@example.test',
  });
  const session: ProviderSession = {
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: 9999999999999,
    subject: signed.user.id,
  };
  await auth.account.update(session, {
    kind: 'password',
    password: 'new-password',
    currentPassword: 'old-password',
    nonce: '123456',
  });
  expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({
    password: 'new-password',
    current_password: 'old-password',
    nonce: '123456',
  });
  await auth.account.reauthenticate(session);
  expect(request.mock.calls[1][0]).toBe(`${origin}/auth/v1/reauthenticate`);
  expect(request.mock.calls[1][1]?.method).toBe('GET');
  const rejected = fixture(
    {
      error_code: 'reauthentication_needed',
      message: 'private provider detail',
    },
    400,
  );
  await expect(
    rejected.auth.account.update(session, {
      kind: 'password',
      password: 'new-password',
      currentPassword: 'old-password',
    }),
  ).rejects.toMatchObject({ kind: 'reauthenticationRequired' });
});

test('account details reject mismatched subjects and malformed email without leaking provider content', async () => {
  const session: ProviderSession = {
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: 9999999999999,
    subject: signed.user.id,
  };
  await expect(
    fixture({
      id: '22222222-2222-4222-8222-222222222222',
      email: 'other@example.test',
    }).auth.account.read(session),
  ).rejects.toThrow('Sign in again');
  await expect(
    fixture({ id: signed.user.id, email: 'invalid' }).auth.account.read(
      session,
    ),
  ).rejects.toThrow('Invalid account response');
  const { auth, request } = fixture();
  await expect(
    auth.account.update(session, { kind: 'email', email: 'invalid' }),
  ).rejects.toThrow('valid email');
  expect(request).not.toHaveBeenCalled();
});

test('ambiguous account update failure never retries or claims a definite failure', async () => {
  const request = jest.fn<typeof fetch>(async () => {
    throw new Error('private transport detail');
  });
  const auth = createSupabaseAuth({ config, request });
  const session: ProviderSession = {
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: 9999999999999,
    subject: signed.user.id,
  };
  await expect(
    auth.account.update(session, { kind: 'email', email: 'new@example.test' }),
  ).rejects.toThrow('Could not confirm the update');
  expect(request).toHaveBeenCalledTimes(1);
});

test.each([
  ['current_password_mismatch', 'Check your current password'],
  ['weak_password', 'stronger password'],
  ['same_password', 'different new password'],
  ['email_exists', 'email cannot be used'],
  ['insufficient_aal', 'additional verification'],
  ['reauthentication_not_valid', 'invalid or expired'],
])(
  'account error %s has bounded recovery without provider text',
  async (error_code, message) => {
    const session: ProviderSession = {
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: 9999999999999,
      subject: signed.user.id,
    };
    await expect(
      fixture(
        { error_code, message: 'private-provider-data' },
        400,
      ).auth.account.update(session, {
        kind: 'password',
        password: 'new-password',
        currentPassword: 'old-password',
      }),
    ).rejects.toThrow(message);
  },
);

test('email update cannot report success from an unrelated or unchanged response', async () => {
  const session: ProviderSession = {
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: 9999999999999,
    subject: signed.user.id,
  };
  await expect(
    fixture({
      id: signed.user.id,
      email: 'old@example.test',
    }).auth.account.update(session, {
      kind: 'email',
      email: 'new@example.test',
    }),
  ).rejects.toThrow('Could not confirm');
});
