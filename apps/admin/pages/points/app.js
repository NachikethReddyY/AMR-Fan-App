import { bindPasswordSignIn, loadAdminConfig } from '../../auth/admin.js';

const byId = (id) => document.getElementById(id);
let token = null;
let profileId = null;
let profilesCursor = null;
let historyCursor = null;
let pending = null;
let busy = false;
const message = (text) => {
  byId('message').textContent = text;
};
function signedOut() {
  token = null;
  profileId = null;
  pending = null;
  byId('workspace').hidden = true;
  byId('logout').hidden = true;
  byId('signin').hidden = false;
  byId('history').replaceChildren();
  byId('profile').replaceChildren();
  byId('balance').textContent = '';
}
async function api(path, method = 'GET', value) {
  const response = await fetch(path, {
    method,
    credentials: 'include',
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(value === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: value === undefined ? undefined : JSON.stringify(value),
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) signedOut();
    throw new Error(data.error ?? 'Request failed.');
  }
  return data;
}
async function work(action) {
  if (busy) return;
  busy = true;
  for (const control of document.querySelectorAll(
    'button, input, textarea, select',
  ))
    control.disabled = true;
  message('Working…');
  try {
    await action();
  } catch (error) {
    message(`${error.message} Retry when ready.`);
  } finally {
    busy = false;
    for (const control of document.querySelectorAll(
      'button, input, textarea, select',
    ))
      control.disabled = false;
  }
}
async function profiles(append = false) {
  const data = await api(
    `/v1/admin/points/profiles${append && profilesCursor ? `?after=${profilesCursor}` : ''}`,
  );
  if (!append) byId('profile').replaceChildren();
  for (const profile of data.profiles) {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = `${profile.displayName} · ${profile.kind} · ${profile.id.slice(0, 8)}`;
    byId('profile').append(option);
  }
  profilesCursor = data.nextCursor;
  byId('more-profiles').hidden = !profilesCursor;
}
async function history(append = false) {
  const selected = byId('profile').value;
  if (!selected) {
    message('No account profiles available.');
    return;
  }
  const data = await api(
    `/v1/admin/profiles/${selected}/points/history${append && historyCursor ? `?before=${historyCursor}` : ''}`,
  );
  profileId = selected;
  if (!append) byId('history').replaceChildren();
  byId('balance').textContent =
    `${data.balance.toLocaleString()} points · ${data.profile.kind} profile`;
  for (const entry of data.entries) {
    const item = document.createElement('li');
    const values = document.createElement('div');
    values.className = 'entry-value';
    const delta = document.createElement('strong');
    delta.textContent = `${entry.delta > 0 ? '+' : ''}${entry.delta.toLocaleString()} points`;
    const balance = document.createElement('span');
    balance.textContent = `Balance ${entry.balanceAfter.toLocaleString()}`;
    values.append(delta, balance);
    const reason = document.createElement('p');
    reason.className = 'entry-reason';
    reason.textContent = entry.reason;
    const meta = document.createElement('p');
    meta.className = 'muted';
    meta.textContent = `${new Date(entry.recordedAt).toLocaleString()} · Admin ${entry.actorId}`;
    item.append(values, reason, meta);
    byId('history').append(item);
  }
  byId('empty').hidden = byId('history').children.length !== 0;
  historyCursor = data.nextCursor;
  byId('more-history').hidden = !historyCursor;
}
async function activate(nextToken) {
  token = nextToken;
  await api('/v1/admin/session');
  byId('signin').hidden = true;
  byId('workspace').hidden = false;
  byId('logout').hidden = false;
  await profiles();
  await history();
  message('');
}
for (const button of document.querySelectorAll('[data-fixture]'))
  button.addEventListener('click', () =>
    work(async () => {
      const session = await api('/v1/dev/session', 'POST', {
        fixture: button.dataset.fixture,
      });
      await activate(session.token);
    }),
  );
byId('logout').addEventListener('click', () =>
  work(async () => {
    await api('/v1/session', 'DELETE');
    signedOut();
    message('Signed out.');
  }),
);
byId('profile-form').addEventListener('submit', (event) => {
  event.preventDefault();
  void work(async () => {
    await history();
    message('');
  });
});
byId('profile').addEventListener('change', () => {
  profileId = null;
  byId('history').replaceChildren();
  byId('balance').textContent = '';
  message('View this profile’s History before adjusting points.');
});
byId('more-profiles').addEventListener('click', () =>
  work(async () => {
    await profiles(true);
    message('');
  }),
);
byId('more-history').addEventListener('click', () =>
  work(async () => {
    await history(true);
    message('');
  }),
);
byId('adjustment').addEventListener('submit', (event) => {
  event.preventDefault();
  const delta = Number(byId('delta').value);
  const reason = byId('reason').value.trim();
  if (!profileId || profileId !== byId('profile').value) {
    message('View the selected profile’s History first.');
    return;
  }
  if (
    !Number.isInteger(delta) ||
    delta === 0 ||
    Math.abs(delta) > 2147483647 ||
    !reason
  ) {
    message('Enter a nonzero whole point change and a reason.');
    return;
  }
  const signature = JSON.stringify([profileId, delta, reason]);
  if (!pending || pending.signature !== signature)
    pending = {
      signature,
      input: {
        targetProfileId: profileId,
        delta,
        reason,
        requestId: crypto.randomUUID(),
      },
    };
  void work(async () => {
    const result = await api(
      '/v1/admin/points/adjustments',
      'POST',
      pending.input,
    );
    pending = null;
    byId('delta').value = '';
    byId('reason').value = '';
    message(
      `Recorded ${result.delta > 0 ? '+' : ''}${result.delta} points. Resulting balance ${result.balanceAfter}.`,
    );
    try {
      await history();
    } catch {
      message('Adjustment recorded. View History to refresh the balance.');
    }
  });
});
try {
  const config = await loadAdminConfig();
  byId('fixtures').hidden = !config.synthetic;
  bindPasswordSignIn(config.auth, { work, onSession: activate });
  byId('setup').textContent =
    config.synthetic || ['supabase', 'oidc'].includes(config.auth?.mode)
      ? ''
      : 'Admin sign-in setup is pending. No local test sign-in is enabled.';
  try {
    await activate(null);
  } catch (error) {
    if (
      !['Sign in again.', 'Assigned admin access required.'].includes(
        error.message,
      )
    )
      throw error;
  }
} catch {
  byId('setup').textContent = 'Sign-in is unavailable. Reload to try again.';
}
