/** @jest-environment node */
import { expect, jest, test } from '@jest/globals';
import { createSupabaseAuth, type ProviderSession } from './supabase';
import { createSessionController, type StoredSession } from './session';
import type { Account, AccountApi } from './api';
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
const neutralSignup =
  'Sign-up could not finish. Try again later, or sign in if you already have an account.';
const signupErrors = [
  ['email_address_invalid', 'Enter a valid email address.'],
  ['signup_disabled', 'New account signup is unavailable. Try again later.'],
  ['email_provider_disabled', 'Email signup is unavailable. Try again later.'],
  [
    'over_request_rate_limit',
    'Too many attempts. Wait a moment and try again.',
  ],
  [
    'over_email_send_rate_limit',
    'Too many attempts. Wait a moment and try again.',
  ],
  ['weak_password', 'Choose a stronger password.'],
  ['user_already_exists', neutralSignup],
  ['email_exists', neutralSignup],
  ['unknown_future_code', neutralSignup],
];
test.each(signupErrors)(
  'signup maps %s in both provider envelopes without reflection or retry',
  async (code, message) => {
    for (const body of [
      { code },
      { error_code: code },
      { code: 422, error_code: code },
    ]) {
      const { auth, request } = fixture(
        {
          ...body,
          message: 'PRIVATE_RESPONSE',
          msg: 'PRIVATE_RESPONSE',
          error_description: 'PRIVATE_RESPONSE',
        },
        422,
      );
      await expect(
        auth.signUp('fan@example.test', 'fixture-password'),
      ).rejects.toThrow(new Error(message));
      expect(request).toHaveBeenCalledTimes(1);
    }
  },
);
test.each([
  null,
  [],
  'PRIVATE_RESPONSE',
  {},
  { code: 422 },
  { code: 'weak_password', error_code: 'user_already_exists' },
  { code: 'unknown_future_code', error_code: 'weak_password' },
  { code: null, error_code: 'weak_password' },
  { code: 'weak_password', error_code: 422 },
  { code: 400, error_code: 'weak_password' },
  { code: {}, error_code: 'weak_password' },
  { code: '', error_code: 'weak_password' },
])(
  'malformed or conflicting signup envelope %j stays neutral',
  async (body) => {
    const { auth, request } = fixture(body, 422);
    await expect(
      auth.signUp('fan@example.test', 'fixture-password'),
    ).rejects.toThrow(new Error(neutralSignup));
    expect(request).toHaveBeenCalledTimes(1);
  },
);
test.each([
  [['length'], 'Choose a longer password.'],
  [
    ['characters'],
    'This password is missing required character types. Choose a different password.',
  ],
  [
    ['pwned'],
    'Choose a different password. This password is known to be compromised.',
  ],
  [['length', 'length'], 'Choose a longer password.'],
  [
    ['length', 'characters'],
    'Choose a longer password. This password is missing required character types. Choose a different password.',
  ],
  [['PRIVATE_RESPONSE'], 'Choose a stronger password.'],
  [['length', 'PRIVATE_RESPONSE'], 'Choose a stronger password.'],
  [[123], 'Choose a stronger password.'],
  [null, 'Choose a stronger password.'],
  ['length', 'Choose a stronger password.'],
  [[], 'Choose a stronger password.'],
])(
  'weak signup reason %j has bounded policy-independent guidance',
  async (reasons, message) => {
    for (const code of [
      { code: 'weak_password' },
      { code: 422, error_code: 'weak_password' },
    ]) {
      const { auth, request } = fixture(
        { ...code, weak_password: { reasons }, message: 'PRIVATE_RESPONSE' },
        422,
      );
      await expect(
        auth.signUp('fan@example.test', 'fixture-password'),
      ).rejects.toThrow(new Error(message));
      expect(request).toHaveBeenCalledTimes(1);
    }
  },
);
test.each([429, 500, 502, 503])(
  'signup HTTP %s is safe even when the error body is not JSON',
  async (status) => {
    const request = jest.fn<typeof fetch>(
      async () => new Response('PRIVATE_RESPONSE', { status }),
    );
    const auth = createSupabaseAuth({ config, request });
    await expect(
      auth.signUp('fan@example.test', 'fixture-password'),
    ).rejects.toThrow(
      new Error(
        status === 429
          ? 'Too many attempts. Wait a moment and try again.'
          : 'Sign-up is temporarily unavailable. Try again later.',
      ),
    );
    expect(request).toHaveBeenCalledTimes(1);
  },
);
test('matching machine codes are unambiguous and weak reasons cannot override unknown errors', async () => {
  await expect(
    fixture(
      { code: 'weak_password', error_code: 'weak_password' },
      422,
    ).auth.signUp('fan@example.test', 'fixture-password'),
  ).rejects.toThrow(new Error('Choose a stronger password.'));
  await expect(
    fixture(
      { code: 'unknown', weak_password: { reasons: ['length'] } },
      422,
    ).auth.signUp('fan@example.test', 'fixture-password'),
  ).rejects.toThrow(new Error(neutralSignup));
});
test.each(['2024-01-01', '2023-01-01', 'invalid', ''])(
  'version header %s never lets conflicting codes select account-specific guidance',
  async (version) => {
    const request = jest.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            code: 'weak_password',
            error_code: 'user_already_exists',
          }),
          { status: 422, headers: { 'x-supabase-api-version': version } },
        ),
    );
    await expect(
      createSupabaseAuth({ config, request }).signUp(
        'fan@example.test',
        'fixture-password',
      ),
    ).rejects.toThrow(new Error(neutralSignup));
    expect(request).toHaveBeenCalledTimes(1);
  },
);
test.each(['invalid JSON', 'body rejection', 'network rejection'])(
  'signup %s does not reflect transport details or automatically retry',
  async (failure) => {
    const response = new Response('PRIVATE_RESPONSE', { status: 422 });
    if (failure === 'body rejection')
      jest
        .spyOn(response, 'text')
        .mockRejectedValue(new Error('PRIVATE_RESPONSE'));
    const request = jest.fn<typeof fetch>(async () => {
      if (failure === 'network rejection') throw new Error('PRIVATE_RESPONSE');
      return response;
    });
    await expect(
      createSupabaseAuth({ config, request }).signUp(
        'fan@example.test',
        'fixture-password',
      ),
    ).rejects.toThrow(
      new Error(
        failure === 'network rejection'
          ? 'Account connection unavailable. Reconnect and try again.'
          : neutralSignup,
      ),
    );
    expect(request).toHaveBeenCalledTimes(1);
  },
);
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

test.each(['read', 'update', 'code'] as const)(
  'logout while cold configuration loads prevents %s transport dispatch',
  async (operation) => {
    let resolveConfig: (value: unknown) => void = () => {};
    let configStarted: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      configStarted = resolve;
    });
    const request = jest.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({ id: signed.user.id, email: 'new@example.test' }),
        ),
    );
    const auth = createSupabaseAuth({
      request,
      config: () => {
        configStarted();
        return new Promise((resolve) => {
          resolveConfig = resolve;
        });
      },
    });
    const account = { id: 'fan', role: 'fan', profiles: [] } satisfies Account;
    let stored: StoredSession | null = {
      kind: 'active',
      token: 'app-session',
      selected: 'real',
      provider: {
        accessToken: 'synthetic-access',
        refreshToken: 'synthetic-refresh',
        expiresAt: Date.now() + 3600000,
        subject: signed.user.id,
      },
    };
    const api: AccountApi = {
      resume: async () => account,
      logout: async () => {},
      signIn: async () => {
        throw new Error('unused');
      },
      syntheticSignIn: async () => {
        throw new Error('unused');
      },
      rename: async () => {
        throw new Error('unused');
      },
      history: async () => {
        throw new Error('unused');
      },
    };
    const controller = createSessionController(
      api,
      {
        read: async () => stored,
        write: async (next) => {
          stored = next;
        },
        clear: async () => {
          stored = null;
        },
      },
      { ...auth, revoke: async () => {} },
    );
    await controller.resume();
    const edit =
      operation === 'read'
        ? controller.readAccountDetails()
        : operation === 'code'
          ? controller.requestAccountCode()
          : controller.updateAccount({
              kind: 'email',
              email: 'new@example.test',
            });
    const rejection = expect(edit).rejects.toThrow('Account changed');
    await started;
    const logout = controller.logout();
    resolveConfig(await config());
    await rejection;
    await logout;
    expect(request).not.toHaveBeenCalled();
    expect(controller.getState().kind).toBe('signedOut');
  },
);

test.each([
  'body rejection',
  'invalid JSON',
  'invalid account',
  'oversized body',
])(
  'PUT uncertainty after headers is bounded for %s and never retried',
  async (failure) => {
    const response = new Response(
      failure === 'invalid JSON'
        ? '{'
        : failure === 'oversized body'
          ? 'x'.repeat(65537)
          : '{}',
    );
    if (failure === 'body rejection')
      jest
        .spyOn(response, 'text')
        .mockRejectedValue(new Error('PRIVATE_BODY_DETAIL'));
    const request = jest.fn<typeof fetch>(async () => response);
    const auth = createSupabaseAuth({ config, request });
    await expect(
      auth.account.update(
        {
          accessToken: 'access',
          refreshToken: 'refresh',
          expiresAt: Date.now() + 3600000,
          subject: signed.user.id,
        },
        { kind: 'email', email: 'new@example.test' },
      ),
    ).rejects.toThrow('Could not confirm the update');
    expect(request).toHaveBeenCalledTimes(1);
  },
);
