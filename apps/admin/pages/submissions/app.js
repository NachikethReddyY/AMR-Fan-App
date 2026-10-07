import { bindPasswordSignIn, loadAdminConfig } from '../../auth/admin.js';

const byId = (id) => document.getElementById(id);
let token = null;
let cursor = null;
let busy = false;
const pending = new Map();
const message = (text) => {
  byId('message').textContent = text;
};
function signedOut() {
  token = null;
  cursor = null;
  pending.clear();
  byId('workspace').hidden = true;
  byId('logout').hidden = true;
  byId('signin').hidden = false;
  byId('history').replaceChildren();
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
  for (const control of document.querySelectorAll('button, select'))
    control.disabled = true;
  message('Working…');
  try {
    await action();
  } catch (error) {
    message(`${error.message} Retry when ready.`);
  } finally {
    busy = false;
    for (const control of document.querySelectorAll('button, select'))
      control.disabled = false;
  }
}
function paragraph(text, className) {
  const node = document.createElement('p');
  node.textContent = text;
  node.className = className;
  return node;
}
async function decide(submission, status) {
  const signature = `${submission.id}:${status}`;
  if (!pending.has(signature))
    pending.set(signature, { requestId: crypto.randomUUID(), status });
  const result = await api(
    `/v1/admin/submissions/${submission.id}/decision`,
    'POST',
    pending.get(signature),
  );
  pending.delete(signature);
  message(`Submission ${result.status}. The original fee is retained.`);
  try {
    await submissions();
  } catch {
    message(
      `Submission ${result.status}. Refresh submissions to update the list.`,
    );
  }
}
async function submissions(append = false) {
  const query = new URLSearchParams({ status: byId('status').value });
  if (append && cursor) query.set('before', cursor);
  const data = await api(`/v1/admin/submissions?${query}`);
  if (!append) byId('history').replaceChildren();
  for (const submission of data.submissions) {
    const item = document.createElement('li');
    item.append(
      paragraph(submission.text, 'entry-reason'),
      paragraph(
        `${submission.status} · ${submission.profileKind} profile${submission.tag ? ` · ${submission.tag}` : ''}`,
        'muted',
      ),
      paragraph(
        `Submitted ${new Date(submission.createdAt).toLocaleString()} · ${submission.id}`,
        'muted',
      ),
    );
    if (submission.resubmissionOf)
      item.append(
        paragraph(`Paid resubmission of ${submission.resubmissionOf}`, 'muted'),
      );
    if (submission.status === 'pending') {
      const actions = document.createElement('div');
      actions.className = 'profile-controls';
      for (const [label, status] of [
        ['Approve', 'approved'],
        ['Reject', 'rejected'],
      ]) {
        const button = document.createElement('button');
        button.textContent = label;
        button.addEventListener('click', () =>
          work(() => decide(submission, status)),
        );
        actions.append(button);
      }
      item.append(actions);
    } else {
      item.append(
        paragraph(
          `Reviewed ${new Date(submission.moderatedAt).toLocaleString()}`,
          'muted',
        ),
      );
    }
    byId('history').append(item);
  }
  cursor = data.nextCursor;
  byId('more').hidden = !cursor;
  byId('empty').hidden = byId('history').children.length !== 0;
}
async function activate(nextToken) {
  token = nextToken;
  await api('/v1/admin/session');
  byId('signin').hidden = true;
  byId('workspace').hidden = false;
  byId('logout').hidden = false;
  await submissions();
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
byId('filter').addEventListener('submit', (event) => {
  event.preventDefault();
  void work(async () => {
    await submissions();
    message('');
  });
});
byId('status').addEventListener('change', () =>
  work(async () => {
    await submissions();
    message('');
  }),
);
byId('more').addEventListener('click', () =>
  work(async () => {
    await submissions(true);
    message('');
  }),
);
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
