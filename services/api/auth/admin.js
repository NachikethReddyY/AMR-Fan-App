const provider = 'https://folakoxsilrfemctvlxj.supabase.co';
const publicFallbackConfig = {
  synthetic: false,
  auth: { mode: 'unavailable' },
};
const failure = () =>
  new Error('Sign-in failed. Check your email and password.');

async function json(response) {
  if (!response.ok) {
    await response.body?.cancel();
    throw failure();
  }
  const reader = response.body?.getReader();
  if (!reader) throw failure();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 65536) throw failure();
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

/** No password, refresh token, provider session or app token is persisted. */
export async function passwordSession(
  config,
  email,
  password,
  request = fetch,
) {
  if (
    config?.mode !== 'supabase' ||
    config.url !== provider ||
    !/^sb_publishable_[A-Za-z0-9_-]{16,200}$/.test(
      config.publishableKey ?? '',
    ) ||
    typeof email !== 'string' ||
    !email.trim() ||
    email.length > 254 ||
    typeof password !== 'string' ||
    !password ||
    password.length > 1024
  )
    throw failure();
  const options = {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  };
  try {
    const signed = await json(
      await request(`${provider}/auth/v1/token?grant_type=password`, {
        ...options,
        headers: {
          apikey: config.publishableKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), password }),
      }),
    );
    if (
      typeof signed.access_token !== 'string' ||
      signed.access_token.length > 16384
    )
      throw failure();
    const session = await json(
      await request('/v1/session', {
        ...options,
        credentials: 'include',
        headers: { Authorization: `Bearer ${signed.access_token}` },
      }),
    );
    if (
      typeof session.token !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(session.token)
    )
      throw failure();
    return session.token;
  } catch {
    throw failure();
  }
}

export async function loadAdminConfig(request = fetch) {
  try {
    const response = await request('/admin/config', {
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('Admin configuration unavailable.');
    return await response.json();
  } catch {
    // Render may sleep. Supabase's publishable key is safe to expose; role and
    // session checks still happen through the API before any admin data loads.
    return publicFallbackConfig;
  }
}

function randomBytes(size) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

function base64Url(bytes) {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '');
}

async function pkcePair() {
  const verifier = base64Url(randomBytes(32));
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

export function oidcAuthorizeUrl(config, state, challenge) {
  if (
    config?.mode !== 'oidc' ||
    !/^https:\/\//.test(config.authority) ||
    !/^https:\/\//.test(config.redirectUri) ||
    !config.clientId ||
    !config.scope
  )
    throw failure();
  const url = new URL(
    `${config.authority.replace(/\/$/u, '')}/oauth2/v2.0/authorize`,
  );
  url.search = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    response_mode: 'query',
    scope: `openid profile email ${config.scope}`,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  return url.toString();
}

export async function oidcSession(config, request = fetch) {
  if (config?.mode !== 'oidc') throw failure();
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const returnedState = params.get('state');
  const state = sessionStorage.getItem('amr_oidc_state');
  const verifier = sessionStorage.getItem('amr_oidc_verifier');
  if (!code || !returnedState || !state || returnedState !== state || !verifier)
    throw failure();
  sessionStorage.removeItem('amr_oidc_state');
  sessionStorage.removeItem('amr_oidc_verifier');
  const tokenResponse = await request(
    `${config.authority.replace(/\/$/u, '')}/oauth2/v2.0/token`,
    {
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        code_verifier: verifier,
      }),
    },
  );
  const signed = await json(tokenResponse);
  if (typeof signed.access_token !== 'string') throw failure();
  const session = await request('/v1/session', {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    redirect: 'error',
    headers: { Authorization: `Bearer ${signed.access_token}` },
  });
  const appSession = await json(session);
  if (
    typeof appSession.token !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/u.test(appSession.token)
  )
    throw failure();
  window.history.replaceState({}, '', window.location.pathname);
  return appSession.token;
}

export function bindPasswordSignIn(config, { work, onSession }) {
  const form = document.getElementById('password-signin');
  form.hidden = config?.mode !== 'supabase';
  if (config?.mode === 'oidc') {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Sign in with CIAM';
    button.id = 'oidc-signin';
    form.after(button);
    button.addEventListener('click', () =>
      work(async () => {
        const { verifier, challenge } = await pkcePair();
        const state = base64Url(randomBytes(32));
        sessionStorage.setItem('amr_oidc_state', state);
        sessionStorage.setItem('amr_oidc_verifier', verifier);
        window.location.assign(oidcAuthorizeUrl(config, state, challenge));
      }),
    );
    const callback = new URLSearchParams(window.location.search).has('code');
    if (callback)
      void work(async () => {
        await onSession(await oidcSession(config));
      });
    return;
  }
  if (form.hidden) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value;
    let password = document.getElementById('password').value;
    document.getElementById('password').value = '';
    void work(async () => {
      try {
        await onSession(await passwordSession(config, email, password));
      } finally {
        password = '';
      }
    });
  });
}
