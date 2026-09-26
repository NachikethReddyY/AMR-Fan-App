const provider = 'https://folakoxsilrfemctvlxj.supabase.co';
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

export function bindPasswordSignIn(config, { work, onSession }) {
  const form = document.getElementById('password-signin');
  form.hidden = config?.mode !== 'supabase';
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
