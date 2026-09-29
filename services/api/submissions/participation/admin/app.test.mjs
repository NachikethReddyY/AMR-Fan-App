import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

// Reuse the installed Jest environment's DOM implementation; no browser or dependency install.
const require = createRequire(import.meta.url);
const { JSDOM } = createRequire(require.resolve('jest-environment-jsdom'))(
  'jsdom',
);
const html = readFileSync(
  new URL(
    '../../../../../apps/admin/pages/participation/index.html',
    import.meta.url,
  ),
  'utf8',
);
const source = readFileSync(
  new URL(
    '../../../../../apps/admin/pages/participation/app.js',
    import.meta.url,
  ),
  'utf8',
);
const authSource = readFileSync(
  new URL('../../../auth/admin.js', import.meta.url),
  'utf8',
);
const stamp = '2026-09-26T12:00:00.000001Z';
const open = {
  id: 'session-a',
  sequence: '1',
  createdBy: 'admin-a',
  createdAt: stamp,
  state: 'open',
};
const snapshot = {
  id: 'selection-a',
  sessionId: open.id,
  submissionId: 'submission-a',
  rank: 1,
  rankingPointsAtClose: '900719925474099312345',
  approvedAt: stamp,
  selectedAt: stamp,
};
const closed = {
  ...open,
  state: 'closed',
  closedBy: 'admin-a',
  closedAt: stamp,
  selections: [snapshot],
};
const selected = { ...snapshot, status: 'selected' };
const malicious = '<img src=x onerror="alert(1)"><script>alert(1)</script>';

async function waitFor(predicate) {
  const deadline = Date.now() + 1500;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('DOM state did not settle');
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}
async function page(t, custom = () => undefined) {
  const dom = new JSDOM(html, {
    url: 'http://127.0.0.1/admin/participation/',
    runScripts: 'outside-only',
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  const calls = [];
  let accountId = 'admin-a';
  window.TextDecoder = TextDecoder;
  Object.defineProperty(window.crypto, 'randomUUID', { value: randomUUID });
  window.AbortSignal.timeout = AbortSignal.timeout;
  window.fetch = async (path, options = {}) => {
    const call = {
      path,
      ...options,
      value: options.body ? JSON.parse(options.body) : undefined,
    };
    calls.push(call);
    const override = await custom(call);
    if (override) return override;
    if (path === '/v1/dev/session')
      accountId = options.body.includes('fan-b') ? 'admin-b' : 'admin-a';
    const data =
      path === '/admin/config'
        ? { synthetic: true }
        : path === '/v1/dev/session'
          ? {
              token: 'memory-token',
              account: {
                id: options.body.includes('fan-b') ? 'admin-b' : 'admin-a',
              },
            }
          : path === '/v1/me'
            ? { id: accountId }
            : path === '/v1/admin/session'
              ? { role: 'admin' }
              : path.startsWith('/v1/admin/submission-sessions') &&
                  (options.method ?? 'GET') === 'GET'
                ? {
                    items: [{ session: open, selections: [] }],
                    nextCursor: null,
                  }
                : path.startsWith('/v1/submissions/ranking')
                  ? {
                      items: [
                        {
                          id: 'submission-a',
                          text: malicious,
                          tag: 'question',
                          approvedAt: stamp,
                          rankingPoints: '900719925474099312345',
                          status: 'backlog',
                          fulfilment: 'demonstration',
                        },
                      ],
                      nextCursor: null,
                    }
                  : { signedOut: true };
    return Response.json(data);
  };
  window.eval(
    authSource.replaceAll('export ', '') +
      '\n' +
      source.replace(
        "import { bindPasswordSignIn } from '../../../auth/admin.js';",
        '',
      ),
  );
  const byId = (id) => window.document.getElementById(id);
  async function click(id) {
    const control = byId(id);
    assert.ok(control, id);
    assert.equal(control.disabled, false, `${id} enabled`);
    control.click();
    await waitFor(() => byId('workspace').getAttribute('aria-busy') !== 'true');
  }
  async function login(fixture = 'fan-a') {
    window.document.querySelector(`[data-fixture="${fixture}"]`).click();
    await waitFor(() => byId('workspace').getAttribute('aria-busy') !== 'true');
  }
  await waitFor(
    () =>
      !byId('fixtures').hidden ||
      byId('password-signin')?.hidden === false ||
      byId('setup').textContent.includes('pending'),
  );
  return { window, byId, calls, click, login };
}
const json = (value, status = 200) => Response.json(value, { status });
const posts = (p) =>
  p.calls.filter((c) => c.method === 'POST' && c.path.startsWith('/v1/admin/'));

test('current admin gate, literal content, exact totals/timestamps, labels and server-provided ordering', async (t) => {
  const p = await page(t, (c) =>
    c.path.startsWith('/v1/submissions/ranking')
      ? json({
          items: [
            {
              id: 'b',
              text: malicious,
              rankingPoints: '900719925474099312345',
              approvedAt: stamp,
              status: 'backlog',
              tag: 'activity',
            },
            {
              id: 'a',
              text: 'Second exact tie',
              rankingPoints: '900719925474099312345',
              approvedAt: stamp,
              status: 'backlog',
              tag: null,
            },
          ],
          nextCursor: null,
        })
      : undefined,
  );
  await p.login();
  assert.equal(p.byId('workspace').hidden, false);
  assert.match(p.byId('ranking').textContent, /900719925474099312345/);
  assert.ok(p.byId('ranking').textContent.includes(stamp));
  assert.ok(p.byId('ranking').textContent.includes(malicious));
  assert.equal(p.byId('ranking').querySelectorAll('img,script').length, 0);
  assert.ok(
    p.byId('ranking').textContent.indexOf(malicious) <
      p.byId('ranking').textContent.indexOf('Second exact tie'),
  );
  assert.equal(
    p.calls.find((c) => c.path === '/v1/admin/session').headers.Authorization,
    'Bearer memory-token',
  );
  assert.ok(
    p.calls.every((c) => c.credentials === 'omit' && c.cache === 'no-store'),
  );
  assert.equal(p.window.localStorage.length, 0);
  assert.equal(p.window.sessionStorage.length, 0);
  assert.ok(p.byId('message').getAttribute('aria-live'));
});

test('fan denial and current-role/session loss clear private content and action controls', async (t) => {
  let deny = 403;
  const p = await page(t, (c) =>
    c.path === '/v1/admin/session' && deny
      ? json({ error: 'Assigned admin access required.' }, deny)
      : undefined,
  );
  await p.login();
  assert.equal(p.byId('workspace').hidden, true);
  assert.match(p.byId('message').textContent, /admin/i);
  assert.equal(posts(p).length, 0);
  deny = 0;
  await p.login();
  deny = 401;
  await p.click('refresh');
  assert.equal(p.byId('workspace').hidden, true);
  assert.equal(p.byId('sessions').children.length, 0);
  assert.equal(p.byId('ranking').children.length, 0);
});

test('lost create response and double clicks retain one immutable request before a new explicit creation', async (t) => {
  let fail = true;
  const p = await page(t, (c) => {
    if (c.path === '/v1/admin/submission-sessions' && c.method === 'POST') {
      if (fail) {
        fail = false;
        throw new TypeError('Connection lost');
      }
      return json(open, 201);
    }
  });
  await p.login();
  p.byId('create').click();
  p.byId('create').click();
  await waitFor(() => p.byId('workspace').getAttribute('aria-busy') !== 'true');
  assert.equal(posts(p).length, 1);
  assert.equal(p.byId('create').disabled, true);
  assert.equal(p.byId('retry').hidden, false);
  const intent = posts(p)[0].body;
  await p.click('refresh');
  await p.click('retry');
  assert.equal(posts(p)[1].body, intent);
  assert.match(p.byId('receipt').textContent, /session-a/);
  await p.click('create');
  assert.notEqual(posts(p)[2].value.requestId, posts(p)[1].value.requestId);
});

test('close requires explicit confirmation, cancel has no effect, original empty receipt survives failed refresh', async (t) => {
  let closedNow = false;
  const p = await page(t, (c) => {
    if (c.path.endsWith('/close')) {
      closedNow = true;
      return json({ ...closed, selections: [] });
    }
    if (closedNow && c.path === '/v1/admin/session')
      throw new TypeError('Read unavailable');
  });
  await p.login();
  p.window.document.querySelector('[data-close]').click();
  assert.equal(posts(p).length, 0);
  p.window.document.querySelector('[data-cancel-close]').click();
  assert.equal(posts(p).length, 0);
  p.window.document.querySelector('[data-close]').click();
  p.window.document.querySelector('[data-confirm-close]').click();
  await waitFor(() => p.byId('workspace').getAttribute('aria-busy') !== 'true');
  assert.equal(posts(p).length, 1);
  assert.equal(
    posts(p)[0].path,
    '/v1/admin/submission-sessions/session-a/close',
  );
  assert.match(p.byId('receipt').textContent, /No submissions selected/);
  assert.equal(p.byId('retry').hidden, true);
  assert.match(p.byId('message').textContent, /recorded.*Refresh/i);
});

test('selected resolution uses bounded labelled reason and original intent on retry; frozen snapshot is separate from current audit', async (t) => {
  let resolved = false;
  let lose = true;
  const resolution = {
    ...selected,
    status: 'released',
    resolvedBy: 'admin-a',
    resolvedAt: stamp,
    reason: malicious,
    fulfilment: 'demonstration',
  };
  const p = await page(t, (c) => {
    if (
      c.path.startsWith('/v1/admin/submission-sessions') &&
      c.method === 'GET'
    )
      return json({
        items: [
          { session: closed, selections: [resolved ? resolution : selected] },
        ],
        nextCursor: null,
      });
    if (c.path.endsWith('/resolve')) {
      resolved = true;
      if (lose) {
        lose = false;
        throw new TypeError('Lost result');
      }
      return json(resolution);
    }
  });
  await p.login();
  const form = p.window.document.querySelector('[data-resolution]');
  const reason = form.querySelector('textarea');
  const action = form.querySelector('select');
  assert.equal(reason.maxLength, 500);
  assert.ok(p.window.document.querySelector(`label[for="${reason.id}"]`));
  assert.ok(p.window.document.querySelector(`label[for="${action.id}"]`));
  action.value = 'release';
  reason.value = malicious;
  form.querySelector('button').click();
  await waitFor(() => p.byId('workspace').getAttribute('aria-busy') !== 'true');
  assert.equal(posts(p)[0].value.reason, malicious);
  await p.click('refresh');
  assert.match(p.byId('sessions').textContent, /Original selection/);
  assert.match(p.byId('sessions').textContent, /released/);
  assert.equal(p.window.document.querySelector('[data-resolution]'), null);
  await p.click('retry');
  assert.equal(posts(p)[0].body, posts(p)[1].body);
  assert.ok(p.byId('sessions').textContent.includes(malicious));
  assert.equal(p.byId('sessions').querySelectorAll('img,script').length, 0);
  assert.match(p.byId('sessions').textContent, /900719925474099312345/);
});

test('competing resolution returns conflict without automatic retry or replacement; refresh reveals terminal demo fulfilment', async (t) => {
  let terminal = false;
  const p = await page(t, (c) => {
    if (
      c.path.startsWith('/v1/admin/submission-sessions') &&
      c.method === 'GET'
    )
      return json({
        items: [
          {
            session: closed,
            selections: [
              {
                ...selected,
                ...(terminal
                  ? {
                      status: 'fulfilled',
                      resolvedBy: 'other-admin',
                      resolvedAt: stamp,
                      reason: 'Demonstration answer',
                      fulfilment: 'demonstration',
                    }
                  : {}),
              },
            ],
          },
        ],
        nextCursor: null,
      });
    if (c.path.endsWith('/resolve')) {
      terminal = true;
      return json({ error: 'Selection is already resolved.' }, 409);
    }
  });
  await p.login();
  const form = p.window.document.querySelector('[data-resolution]');
  form.querySelector('select').value = 'fulfil';
  form.querySelector('textarea').value = 'Demonstration answer';
  form.querySelector('button').click();
  await waitFor(() => p.byId('workspace').getAttribute('aria-busy') !== 'true');
  assert.equal(posts(p).length, 1);
  assert.equal(p.byId('retry').hidden, true);
  assert.match(p.byId('message').textContent, /Refresh/);
  await p.click('refresh');
  assert.match(p.byId('sessions').textContent, /fulfilled.*demonstration/is);
  assert.equal(p.window.document.querySelector('[data-resolution]'), null);
});

test('unknown outcome remains isolated to its actor across current-authority failure and reauthentication', async (t) => {
  let first = true;
  const p = await page(t, (c) => {
    if (c.path === '/v1/admin/submission-sessions' && c.method === 'POST') {
      if (first) {
        first = false;
        return json({ error: 'Sign in again.' }, 401);
      }
      return json(open, 201);
    }
  });
  await p.login();
  await p.click('create');
  const intent = posts(p)[0].body;
  assert.equal(p.byId('workspace').hidden, true);
  await p.login('fan-b');
  assert.equal(p.byId('retry').hidden, true);
  await p.click('logout');
  await p.login('fan-a');
  assert.equal(p.byId('retry').hidden, false);
  await p.click('retry');
  assert.equal(posts(p)[1].body, intent);
});

test('live lists page independently using opaque server cursors and refresh starts from current first page', async (t) => {
  const p = await page(t, (c) => {
    if (c.path.startsWith('/v1/submissions/ranking'))
      return json({
        items: [
          {
            id: c.path.includes('after=') ? 'later' : 'first',
            text: 'Approved content',
            approvedAt: stamp,
            rankingPoints: '10',
            status: 'backlog',
            tag: null,
          },
        ],
        nextCursor: c.path.includes('after=') ? null : 'opaque-cursor',
      });
    if (
      c.path.startsWith('/v1/admin/submission-sessions') &&
      c.method === 'GET'
    )
      return json({
        items: [
          {
            session: {
              ...open,
              id: c.path.includes('before=') ? 'earlier' : 'newest',
              sequence: c.path.includes('before=') ? '1' : '9007199254740993',
            },
            selections: [],
          },
        ],
        nextCursor: c.path.includes('before=') ? null : '9007199254740993',
      });
  });
  await p.login();
  await p.click('ranking-more');
  await p.click('sessions-more');
  assert.equal(p.byId('ranking').children.length, 2);
  assert.equal(p.byId('sessions').children.length, 2);
  assert.ok(p.calls.some((c) => c.path.includes('after=opaque-cursor')));
  assert.ok(p.calls.some((c) => c.path.includes('before=9007199254740993')));
  await p.click('refresh');
  assert.equal(p.byId('ranking').children.length, 1);
  assert.equal(p.byId('sessions').children.length, 1);
});

test('lost close response keeps its original key after the refreshed session is already closed', async (t) => {
  let completed = false;
  const p = await page(t, (c) => {
    if (c.path.endsWith('/close')) {
      if (!completed) {
        completed = true;
        throw new TypeError('Lost close response');
      }
      return json(closed);
    }
    if (
      completed &&
      c.path.startsWith('/v1/admin/submission-sessions') &&
      c.method === 'GET'
    )
      return json({
        items: [{ session: closed, selections: [selected] }],
        nextCursor: null,
      });
  });
  await p.login();
  p.window.document.querySelector('[data-close]').click();
  assert.ok(p.window.document.activeElement.hasAttribute('data-confirm-close'));
  p.window.document.querySelector('[data-confirm-close]').click();
  await waitFor(() => p.byId('workspace').getAttribute('aria-busy') !== 'true');
  await p.click('refresh');
  assert.equal(p.window.document.querySelector('[data-close]'), null);
  await p.click('retry');
  assert.equal(posts(p)[0].body, posts(p)[1].body);
  assert.match(p.byId('receipt').textContent, /900719925474099312345/);
  assert.equal(p.window.document.activeElement, p.byId('receipt'));
});

test('blank reason has no effect; successful fulfilment preserves original snapshot and exposes audited demonstration result', async (t) => {
  let result = selected;
  const p = await page(t, (c) => {
    if (
      c.path.startsWith('/v1/admin/submission-sessions') &&
      c.method === 'GET'
    )
      return json({
        items: [{ session: closed, selections: [result] }],
        nextCursor: null,
      });
    if (c.path.endsWith('/resolve')) {
      result = {
        ...selected,
        status: 'fulfilled',
        resolvedAt: stamp,
        resolvedBy: 'admin-a',
        reason: c.value.reason,
        fulfilment: 'demonstration',
      };
      return json(result);
    }
  });
  await p.login();
  const form = p.window.document.querySelector('[data-resolution]');
  const reason = form.querySelector('textarea');
  const action = form.querySelector('select');
  action.value = 'fulfil';
  reason.value = '   ';
  form.querySelector('button').click();
  assert.equal(posts(p).length, 0);
  reason.value = 'A demonstration answer';
  reason.dispatchEvent(new p.window.Event('input'));
  form.querySelector('button').click();
  await waitFor(() => p.byId('workspace').getAttribute('aria-busy') !== 'true');
  assert.equal(posts(p)[0].value.action, 'fulfil');
  assert.match(p.byId('receipt').textContent, /fulfilled.*demonstration/is);
  assert.match(
    p.byId('sessions').textContent,
    /Original selection.*900719925474099312345.*Current resolution.*fulfilled/is,
  );
  assert.equal(p.window.document.querySelector('[data-resolution]'), null);
});

test('a failed refresh disables stale mutations until fresh current-state reads succeed', async (t) => {
  let fail = false;
  const p = await page(t, (c) => {
    if (fail && c.path.startsWith('/v1/admin/submission-sessions'))
      throw new TypeError('Read unavailable');
  });
  await p.login();
  fail = true;
  await p.click('refresh');
  assert.equal(p.byId('create').disabled, true);
  assert.equal(p.window.document.querySelector('[data-close]').disabled, true);
  fail = false;
  await p.click('refresh');
  assert.equal(p.byId('create').disabled, false);
});

test('selected immutable content is rendered literally even outside the current ranking page', async (t) => {
  const p = await page(t, (c) => {
    if (
      c.path.startsWith('/v1/admin/submission-sessions') &&
      c.method === 'GET'
    )
      return json({
        items: [
          {
            session: closed,
            selections: [selected],
            content: [
              { id: snapshot.submissionId, text: malicious, tag: 'activity' },
            ],
          },
        ],
        nextCursor: null,
      });
    if (c.path.startsWith('/v1/submissions/ranking'))
      return json({ items: [], nextCursor: null });
  });
  await p.login();
  assert.ok(p.byId('sessions').textContent.includes(malicious));
  assert.equal(p.byId('sessions').querySelectorAll('img,script').length, 0);
});

test('narrow-width preparation retains shared geometry and wraps long content; no layout proof is inferred', () => {
  const css = readFileSync(
    new URL(
      '../../../../../apps/admin/pages/participation/style.css',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(html, /href="\/admin\/style.css"/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /max-width: 100%/);
  assert.doesNotMatch(
    css,
    /min-width:\s*\d+[1-9]\d*px|position:\s*fixed|animation/,
  );
});

test('hosted sign-in uses the shared helper, clears passwords and retains actor-isolated original intent', async (t) => {
  let identity = 'admin-a';
  let lost = true;
  const p = await page(t, (c) => {
    if (c.path === '/admin/config')
      return json({
        synthetic: false,
        auth: {
          mode: 'supabase',
          url: 'https://folakoxsilrfemctvlxj.supabase.co',
          publishableKey: 'sb_publishable_' + 'fixture'.repeat(3),
        },
      });
    if (c.path.startsWith('https://'))
      return json({ access_token: 'synthetic-provider-token' });
    if (c.path === '/v1/session' && c.method === 'POST')
      return json({ token: 'a'.repeat(43) });
    if (c.path === '/v1/me') return json({ id: identity });
    if (c.path === '/v1/admin/submission-sessions' && c.method === 'POST') {
      if (lost) {
        lost = false;
        throw new TypeError('Lost committed response');
      }
      return json(open, 201);
    }
  });
  assert.ok(p.byId('password-signin'), 'Hosted sign-in form is registered');
  assert.equal(p.byId('password-signin').hidden, false);
  assert.equal(p.byId('fixtures').hidden, true);
  async function signIn() {
    p.byId('email').value = 'synthetic@example.test';
    p.byId('password').value = 'synthetic-password';
    p.byId('password-signin').dispatchEvent(
      new p.window.Event('submit', { bubbles: true, cancelable: true }),
    );
    assert.equal(p.byId('password').value, '');
    await waitFor(
      () => p.byId('workspace').getAttribute('aria-busy') !== 'true',
    );
  }
  await signIn();
  assert.equal(p.byId('workspace').hidden, false);
  assert.equal(
    p.calls.find((c) => c.path === '/v1/admin/session').headers.Authorization,
    'Bearer ' + 'a'.repeat(43),
  );
  await p.click('create');
  const original = posts(p)[0].value;
  await p.click('logout');
  identity = 'admin-b';
  await signIn();
  assert.equal(p.byId('retry').hidden, true);
  await p.click('logout');
  identity = 'admin-a';
  await signIn();
  assert.equal(p.byId('retry').hidden, false);
  await p.click('retry');
  assert.deepEqual(posts(p)[1].value, original);
  assert.equal(p.window.localStorage.length, 0);
  assert.equal(p.window.sessionStorage.length, 0);
  assert.ok(
    p.calls
      .filter((c) => c.value?.password)
      .every(
        (c) =>
          c.path ===
          'https://folakoxsilrfemctvlxj.supabase.co/auth/v1/token?grant_type=password',
      ),
  );
});

test('hosted fan denial clears private state and password without trusting provider role', async (t) => {
  const p = await page(t, (c) => {
    if (c.path === '/admin/config')
      return json({
        synthetic: false,
        auth: {
          mode: 'supabase',
          url: 'https://folakoxsilrfemctvlxj.supabase.co',
          publishableKey: 'sb_publishable_' + 'fixture'.repeat(3),
        },
      });
    if (c.path.startsWith('https://'))
      return json({ access_token: 'synthetic', user: { role: 'admin' } });
    if (c.path === '/v1/session' && c.method === 'POST')
      return json({ token: 'a'.repeat(43) });
    if (c.path === '/v1/admin/session')
      return json({ error: 'Assigned admin access required.' }, 403);
  });
  assert.ok(p.byId('password-signin'), 'Hosted sign-in form exists');
  p.byId('email').value = 'fan@example.test';
  p.byId('password').value = 'synthetic-password';
  p.byId('password-signin').dispatchEvent(
    new p.window.Event('submit', { cancelable: true }),
  );
  await waitFor(() => p.byId('workspace').getAttribute('aria-busy') !== 'true');
  assert.equal(p.byId('workspace').hidden, true);
  assert.equal(p.byId('password').value, '');
  assert.equal(
    p.calls.some((c) => c.path === '/v1/me'),
    false,
  );
  assert.equal(posts(p).length, 0);
  assert.match(p.byId('message').textContent, /Assigned admin/);
});
