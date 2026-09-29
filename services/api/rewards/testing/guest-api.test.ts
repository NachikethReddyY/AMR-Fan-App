import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { createApi } from '../../api/app.ts';
import { createDatabase } from '../../database/index.ts';
import { migrate } from '../../database/migrate.ts';
import { assignRole, ensureAccount } from '../../accounts/store.ts';
import { createSession } from '../../auth/session.ts';

if (
  process.env.NODE_ENV !== 'test' ||
  new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname !==
    '/amr_c787guest_test'
)
  throw new Error(
    'Use the isolated guest catalogue fixture, never a retained database.',
  );
const pool = createDatabase();
let server: ReturnType<typeof createApi>;
let base = '';
let fanToken = '';
let profileId = '';
let enabled: string[] = [];
let disabled = '';
const paidText = 'PRIVATE CONTENT MUST NEVER APPEAR IN A CATALOGUE';
before(async () => {
  await migrate(pool);
  server = createApi({
    pool,
    env: {
      NODE_ENV: 'test',
      AUTH_DEV_ENABLED: 'true',
      API_HOST: '127.0.0.1',
      ADMIN_ORIGIN: 'https://approved.test',
    },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
  const admin = await ensureAccount(pool, {
    issuer: 'urn:guest-test',
    subject: 'admin',
  });
  await assignRole(pool, admin.id, 'admin', 'Isolated guest catalogue fixture');
  const adminSession = await createSession(pool, admin.id);
  const fan = await ensureAccount(pool, {
    issuer: 'urn:guest-test',
    subject: 'fan',
  });
  fanToken = (await createSession(pool, fan.id)).token;
  profileId = fan.profiles[0].id;
  for (let index = 0; index < 4; index++) {
    const response = await fetch(`${base}/v1/admin/rewards/offers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminSession.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestId: randomUUID(),
        enabled: index < 3,
        product: {
          kind: 'content',
          title: `Fixture reward ${index}`,
          description: 'Stored catalogue description',
          pointsPrice: 71 + index,
          text: paidText,
        },
      }),
    });
    assert.equal(response.status, 201);
    const offer = await response.json();
    if (index < 3) enabled.push(offer.id);
    else disabled = offer.id;
  }
  enabled = enabled.sort();
});
after(async () => {
  if (server) {
    server.close();
    await once(server, 'close');
  }
  await pool.end();
});
test('actual guest GET returns enabled stored prices/descriptions in bounded pages without paid content', async () => {
  const start = performance.now();
  const first = await fetch(`${base}/v1/rewards/offers?limit=2`);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('cache-control'), 'no-store');
  const raw = await first.text();
  assert.equal(raw.includes(paidText), false);
  assert.equal(raw.includes('"text"'), false);
  assert.equal(raw.includes(disabled), false);
  const page = JSON.parse(raw);
  assert.deepEqual(
    page.offers.map((o: { id: string }) => o.id),
    enabled.slice(0, 2),
  );
  assert.equal(page.nextCursor, enabled[1]);
  for (const offer of page.offers) {
    assert.equal(offer.enabled, true);
    assert.equal(offer.product.description, 'Stored catalogue description');
    assert.equal(
      offer.product.pointsPrice,
      71 + Number(offer.product.title.at(-1)),
    );
  }
  const more = await fetch(
    `${base}/v1/rewards/offers?limit=2&after=${page.nextCursor}`,
  );
  assert.equal(more.status, 200);
  const last = await more.json();
  assert.deepEqual(
    last.offers.map((o: { id: string }) => o.id),
    enabled.slice(2),
  );
  assert.equal(last.nextCursor, null);
  const empty = await fetch(
    `${base}/v1/rewards/offers?after=ffffffff-ffff-4fff-bfff-ffffffffffff`,
  );
  assert.deepEqual(await empty.json(), { offers: [], nextCursor: null });
  console.log(
    JSON.stringify({
      fixture: 'isolated guest catalogue',
      firstPageBytes: Buffer.byteLength(raw),
      firstPageAndPaginationMs: Math.round(performance.now() - start),
      privateContentAbsent: true,
    }),
  );
});
test('only exact GET is public; profile/private/admin/mutation routes retain authentication', async () => {
  for (const [path, method] of [
    ['/v1/rewards/offers', 'POST'],
    ['/v1/rewards/offers', 'PATCH'],
    ['/v1/rewards/offers', 'HEAD'],
    ['/v1/rewards/offers/', 'GET'],
    [`/v1/rewards/offers/${enabled[0]}`, 'GET'],
    ['/v1/rewards/purchases', 'POST'],
    ['/v1/admin/rewards/offers', 'GET'],
    [`/v1/profiles/${profileId}/rewards/offers`, 'GET'],
    [`/v1/profiles/${profileId}/rewards/receipts`, 'GET'],
    [`/v1/profiles/${profileId}/rewards/content/${enabled[0]}`, 'GET'],
    [`/v1/profiles/${profileId}/points/history`, 'GET'],
    ['/v1/me', 'GET'],
    ['/v1/submissions', 'GET'],
  ])
    assert.equal(
      (await fetch(`${base}${path}`, { method })).status,
      401,
      `${method} ${path}`,
    );
  const own = await fetch(`${base}/v1/profiles/${profileId}/rewards/offers`, {
    headers: { Authorization: `Bearer ${fanToken}` },
  });
  assert.equal(own.status, 200);
  assert.equal((await own.text()).includes(paidText), false);
  assert.equal(
    (
      await fetch(
        `${base}/v1/profiles/${profileId}/rewards/content/${enabled[0]}`,
        { headers: { Authorization: `Bearer ${fanToken}` } },
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await fetch(`${base}/v1/admin/rewards/offers`, {
        headers: { Authorization: `Bearer ${fanToken}` },
      })
    ).status,
    403,
  );
});
test('guest query validation, origin guard and global request limit remain active', async () => {
  for (const query of [
    'limit=0',
    'limit=26',
    'after=invalid',
    'enabled=false',
    'token=forged',
  ])
    assert.equal(
      (await fetch(`${base}/v1/rewards/offers?${query}`)).status,
      400,
    );
  assert.equal(
    (
      await fetch(`${base}/v1/rewards/offers`, {
        headers: { Origin: 'https://foreign.test' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(`${base}/v1/rewards/offers`, {
        headers: { Origin: 'https://approved.test' },
      })
    ).status,
    200,
  );
  let status = 200;
  for (let count = 0; count < 301 && status !== 429; count++)
    status = (await fetch(`${base}/v1/rewards/offers`)).status;
  assert.equal(status, 429);
});
