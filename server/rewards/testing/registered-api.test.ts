import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { createApi } from '../../api/app.ts';
import { createDatabase } from '../../database/index.ts';
import { migrate } from '../../database/migrate.ts';
import { assignRole, ensureAccount } from '../../accounts/store.ts';
import { createSession } from '../../auth/session.ts';

if (
  process.env.NODE_ENV !== 'test' ||
  !/^\/amr_[a-f0-9]{12}_test$/.test(
    new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname,
  )
)
  throw new Error('Use this worktree disposable test database.');

const pool = createDatabase();
const issuer = `urn:amr:rewards-http:${randomUUID()}`;
let server: ReturnType<typeof createApi>;
let base = '';
async function account(subject: string, admin = false) {
  const value = await ensureAccount(pool, { issuer, subject });
  if (admin)
    await assignRole(pool, value.id, 'admin', 'Synthetic HTTP rewards test');
  const { token } = await createSession(pool, value.id);
  const real = value.profiles.find((profile) => profile.kind === 'real');
  const demo = value.profiles.find((profile) => profile.kind === 'demo');
  assert.ok(real && demo);
  return { ...value, token, real, demo };
}
async function request(
  path: string,
  token: string,
  method = 'GET',
  body?: unknown,
  origin?: string,
) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(origin ? { Origin: origin } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function data(response: Response, status = 200) {
  assert.equal(response.status, status);
  return response.json();
}
before(async () => {
  await migrate(pool);
  server = createApi({
    pool,
    env: {
      NODE_ENV: 'test',
      AUTH_DEV_ENABLED: 'true',
      API_HOST: '127.0.0.1',
      ADMIN_ORIGIN: 'http://127.0.0.1:54321',
    },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  if (server) {
    server.close();
    await once(server, 'close');
  }
  await pool.end();
});
const synthetic = {
  kind: 'content',
  title: 'Synthetic fan notebook',
  description: 'Original demonstration text. No official team claims.',
  pointsPrice: 100,
  text: 'Synthetic story: A fan takes a short walk, notices a small leaf and draws it in a notebook.',
};

test('registered admin catalogue and fan confirmation/purchase/access/History flow retains text after disablement', async () => {
  const admin = await account('admin', true);
  const fan = await account('fan');
  const other = await account('other');
  const offer = await data(
    await request('/v1/admin/rewards/offers', admin.token, 'POST', {
      requestId: randomUUID(),
      enabled: true,
      product: synthetic,
    }),
    201,
  );
  await data(
    await request('/v1/admin/points/adjustments', admin.token, 'POST', {
      targetProfileId: fan.real.id,
      requestId: randomUUID(),
      delta: 250,
      reason: 'Synthetic HTTP purchase fixture',
    }),
    201,
  );
  const confirmation = await data(
    await request(
      `/v1/profiles/${fan.real.id}/rewards/offers/${offer.id}`,
      fan.token,
    ),
  );
  assert.equal(confirmation.product.pointsPrice, 100);
  assert.equal(Object.hasOwn(confirmation.product, 'text'), false);
  const input = {
    profileId: fan.real.id,
    requestId: randomUUID(),
    offerId: offer.id,
    offerVersion: offer.version,
  };
  const paid = await data(
    await request('/v1/rewards/purchases', fan.token, 'POST', input),
    201,
  );
  assert.equal(paid.entry.delta, -100);
  assert.equal(paid.entry.balanceAfter, 150);
  const content = await data(
    await request(
      `/v1/profiles/${fan.real.id}/rewards/content/${offer.id}`,
      fan.token,
    ),
  );
  assert.equal(content.text, synthetic.text);
  const page = await data(
    await request(`/v1/profiles/${fan.real.id}/points/history`, fan.token),
  );
  assert.equal(page.balance, 150);
  assert.deepEqual(page.entries[0], paid.entry);
  await data(
    await request('/v1/admin/rewards/offers', admin.token, 'PATCH', {
      requestId: randomUUID(),
      offerId: offer.id,
      expectedVersion: 1,
      enabled: false,
      product: {
        ...synthetic,
        pointsPrice: 150,
        text: 'A different original synthetic paragraph.',
      },
    }),
  );
  assert.deepEqual(
    await data(
      await request('/v1/rewards/purchases', fan.token, 'POST', input),
      201,
    ),
    paid,
  );
  const acknowledgement = await data(
    await request('/v1/rewards/purchases', fan.token, 'POST', {
      ...input,
      requestId: randomUUID(),
    }),
    201,
  );
  assert.equal(acknowledgement.entry.delta, 0);
  assert.deepEqual(acknowledgement.outcome, paid.outcome);
  assert.deepEqual(
    await data(
      await request(
        `/v1/profiles/${fan.real.id}/rewards/content/${offer.id}`,
        fan.token,
      ),
    ),
    content,
  );
  assert.equal(
    (
      await request(
        `/v1/profiles/${fan.real.id}/rewards/content/${offer.id}`,
        other.token,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request(
        `/v1/profiles/${fan.demo.id}/rewards/content/${offer.id}`,
        fan.token,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request('/v1/rewards/purchases', other.token, 'POST', {
        ...input,
        profileId: other.real.id,
        requestId: randomUUID(),
        offerVersion: 2,
      })
    ).status,
    409,
  );
});

test('registered HTTP rejects forged inputs, browser origins, anonymous/fan admin and revoked roles', async () => {
  const admin = await account('boundary-admin', true);
  const fan = await account('boundary-fan');
  for (const [token, status] of [
    ['', 401],
    [fan.token, 403],
  ] as const)
    assert.equal(
      (await request('/v1/admin/rewards/offers', token)).status,
      status,
    );
  assert.equal(
    (
      await request(
        '/v1/admin/rewards/offers',
        admin.token,
        'GET',
        undefined,
        'https://foreign.example.test',
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        '/v1/admin/rewards/offers',
        admin.token,
        'GET',
        undefined,
        'http://127.0.0.1:54321',
      )
    ).status,
    200,
  );
  for (const product of [
    { ...synthetic, pointsPrice: 0 },
    { ...synthetic, pointsPrice: 1.5 },
    { ...synthetic, role: 'admin' },
    {
      kind: 'discount',
      title: 'Synthetic',
      description: 'Demo',
      pointsPrice: 100,
      percentage: 61,
    },
  ])
    assert.equal(
      (
        await request('/v1/admin/rewards/offers', admin.token, 'POST', {
          requestId: randomUUID(),
          enabled: true,
          product,
        })
      ).status,
      400,
    );
  assert.equal(
    (
      await request('/v1/admin/rewards/offers', admin.token, 'POST', {
        text: 'x'.repeat(5000),
      })
    ).status,
    413,
  );
  await assignRole(pool, admin.id, 'fan', 'Synthetic role revoke');
  assert.equal(
    (await request('/v1/admin/rewards/offers', admin.token)).status,
    403,
  );
});

test('admin assets preserve strict CSP and synthetic sign-in remains explicitly selected', async () => {
  const response = await fetch(`${base}/admin/rewards/`);
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get('content-security-policy') ?? '',
    /script-src 'self'/,
  );
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  const html = await response.text();
  assert.match(html, /Rewards administration/);
  assert.match(html, /DEMONSTRATION/);
  assert.match(html, /\/admin\/style.css/);
  assert.equal((await fetch(`${base}/admin/rewards/app.js`)).status, 200);
  assert.equal((await fetch(`${base}/admin/style.css`)).status, 200);
});

test('purchase receipt and content right survive an actual API process restart', async () => {
  const admin = await account('restart-admin', true);
  const fan = await account('restart-fan');
  const offer = await data(
    await request('/v1/admin/rewards/offers', admin.token, 'POST', {
      requestId: randomUUID(),
      enabled: true,
      product: synthetic,
    }),
    201,
  );
  await data(
    await request('/v1/admin/points/adjustments', admin.token, 'POST', {
      targetProfileId: fan.real.id,
      requestId: randomUUID(),
      delta: 100,
      reason: 'Synthetic restart fixture',
    }),
    201,
  );
  const input = {
    profileId: fan.real.id,
    requestId: randomUUID(),
    offerId: offer.id,
    offerVersion: 1,
  };
  async function child() {
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL('./api-process.ts', import.meta.url))],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    const exit = once(child, 'exit');
    const [chunk] = await once(child.stdout, 'data');
    const port = Number(String(chunk).trim());
    assert.ok(Number.isInteger(port) && port > 0);
    return {
      url: `http://127.0.0.1:${port}`,
      stop: async () => {
        child.kill('SIGTERM');
        await exit;
      },
    };
  }
  const initial = await child();
  let saved;
  try {
    saved = await data(
      await fetch(`${initial.url}/v1/rewards/purchases`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${fan.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      }),
      201,
    );
  } finally {
    await initial.stop();
  }
  const resumed = await child();
  try {
    const replay = await data(
      await fetch(`${resumed.url}/v1/rewards/purchases`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${fan.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      }),
      201,
    );
    assert.deepEqual(replay, saved);
    const content = await data(
      await fetch(
        `${resumed.url}/v1/profiles/${fan.real.id}/rewards/content/${offer.id}`,
        { headers: { Authorization: `Bearer ${fan.token}` } },
      ),
    );
    assert.equal(content.text, synthetic.text);
  } finally {
    await resumed.stop();
  }
});

test('HTTP mixed purchases serialize funds; stale confirmations and changed request payloads cannot charge', async () => {
  const admin = await account('mixed-admin', true);
  const fan = await account('mixed-fan');
  await data(
    await request('/v1/admin/points/adjustments', admin.token, 'POST', {
      targetProfileId: fan.real.id,
      requestId: randomUUID(),
      delta: 150,
      reason: 'Synthetic mixed fixture',
    }),
    201,
  );
  const offers = [];
  for (const product of [
    {
      kind: 'tree',
      title: 'Synthetic tree participation',
      description: 'Demonstration only.',
      pointsPrice: 100,
    },
    {
      kind: 'discount',
      title: 'Synthetic 60% voucher',
      description: 'Demonstration only. No retailer code.',
      pointsPrice: 100,
      percentage: 60,
    },
    synthetic,
  ])
    offers.push(
      await data(
        await request('/v1/admin/rewards/offers', admin.token, 'POST', {
          requestId: randomUUID(),
          enabled: true,
          product,
        }),
        201,
      ),
    );
  const inputs = offers.map((offer) => ({
    profileId: fan.real.id,
    offerId: offer.id,
    offerVersion: 1,
    requestId: randomUUID(),
  }));
  const results = await Promise.all(
    inputs.map((input) =>
      request('/v1/rewards/purchases', fan.token, 'POST', input),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409]);
  const winner = results.findIndex((r) => r.status === 201);
  const saved = await results[winner].json();
  const page = await data(
    await request(`/v1/profiles/${fan.real.id}/points/history`, fan.token),
  );
  assert.equal(page.balance, 50);
  assert.equal(page.entries.length, 2);
  assert.deepEqual(page.entries[0], saved.entry);
  assert.equal(
    (
      await data(
        await request(
          `/v1/profiles/${fan.real.id}/rewards/receipts`,
          fan.token,
        ),
      )
    ).receipts.length,
    1,
  );
  for (const change of [
    { offerVersion: 2 },
    { offerId: offers[(winner + 1) % 3].id },
    { profileId: fan.demo.id },
  ])
    assert.equal(
      (
        await request('/v1/rewards/purchases', fan.token, 'POST', {
          ...inputs[winner],
          ...change,
        })
      ).status,
      409,
    );
  const offer = offers[(winner + 1) % 3];
  await data(
    await request('/v1/admin/rewards/offers', admin.token, 'PATCH', {
      requestId: randomUUID(),
      offerId: offer.id,
      expectedVersion: 1,
      enabled: true,
      product: { ...offer.product, pointsPrice: 125 },
    }),
  );
  const stale = await request('/v1/rewards/purchases', fan.token, 'POST', {
    profileId: fan.real.id,
    offerId: offer.id,
    offerVersion: 1,
    requestId: randomUUID(),
  });
  assert.equal(stale.status, 409);
  assert.match((await stale.json()).error, /Offer changed/);
  assert.equal(
    (
      await data(
        await request(
          `/v1/profiles/${fan.real.id}/rewards/offers/${offer.id}`,
          fan.token,
        ),
      )
    ).product.pointsPrice,
    125,
  );
  assert.deepEqual(
    await data(
      await request('/v1/rewards/purchases', fan.token, 'POST', inputs[winner]),
      201,
    ),
    saved,
  );
});

test('HTTP tree and voucher snapshots remain paid once; receipt-write failure rolls the accounting back', async () => {
  const admin = await account('snapshot-admin', true);
  const fan = await account('snapshot-fan');
  await data(
    await request('/v1/admin/points/adjustments', admin.token, 'POST', {
      targetProfileId: fan.real.id,
      requestId: randomUUID(),
      delta: 1000,
      reason: 'Synthetic snapshot fixture',
    }),
    201,
  );
  for (const product of [
    {
      kind: 'tree',
      title: 'Synthetic programme participation',
      description: 'Demonstration only.',
      pointsPrice: 100,
    },
    {
      kind: 'discount',
      title: 'Synthetic 10% voucher',
      description: 'Demonstration only.',
      pointsPrice: 100,
      percentage: 10,
    },
    {
      kind: 'discount',
      title: 'Synthetic 60% voucher',
      description: 'Demonstration only.',
      pointsPrice: 200,
      percentage: 60,
    },
  ]) {
    const offer = await data(
      await request('/v1/admin/rewards/offers', admin.token, 'POST', {
        requestId: randomUUID(),
        enabled: true,
        product,
      }),
      201,
    );
    const input = {
      profileId: fan.real.id,
      offerId: offer.id,
      offerVersion: 1,
      requestId: randomUUID(),
    };
    const paid = await data(
      await request('/v1/rewards/purchases', fan.token, 'POST', input),
      201,
    );
    assert.equal(paid.outcome.fulfilment, 'demonstration');
    assert.equal(paid.outcome.paidPoints, product.pointsPrice);
    if (product.kind === 'discount')
      assert.equal(paid.outcome.percentage, product.percentage);
    await data(
      await request('/v1/admin/rewards/offers', admin.token, 'PATCH', {
        requestId: randomUUID(),
        offerId: offer.id,
        expectedVersion: 1,
        enabled: false,
        product: { ...product, pointsPrice: 250 },
      }),
    );
    assert.deepEqual(
      await data(
        await request('/v1/rewards/purchases', fan.token, 'POST', input),
        201,
      ),
      paid,
    );
  }
  const before = await data(
    await request(`/v1/profiles/${fan.real.id}/points/history`, fan.token),
  );
  const receipts = await data(
    await request(`/v1/profiles/${fan.real.id}/rewards/receipts`, fan.token),
  );
  const broken = await data(
    await request('/v1/admin/rewards/offers', admin.token, 'POST', {
      requestId: randomUUID(),
      enabled: true,
      product: synthetic,
    }),
    201,
  );
  // Synthetic DB failure at the domain-write boundary, using this disposable namespace only.
  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');
    await connection.query(
      'ALTER TABLE app.reward_receipts ADD CONSTRAINT synthetic_reject_receipt CHECK (false) NOT VALID',
    );
    await connection.query('COMMIT');
    assert.equal(
      (
        await request('/v1/rewards/purchases', fan.token, 'POST', {
          profileId: fan.real.id,
          offerId: broken.id,
          offerVersion: 1,
          requestId: randomUUID(),
        })
      ).status,
      500,
    );
  } finally {
    await connection.query('ROLLBACK');
    await connection.query(
      'ALTER TABLE app.reward_receipts DROP CONSTRAINT IF EXISTS synthetic_reject_receipt',
    );
    connection.release();
  }
  assert.deepEqual(
    await data(
      await request(`/v1/profiles/${fan.real.id}/points/history`, fan.token),
    ),
    before,
  );
  assert.deepEqual(
    await data(
      await request(`/v1/profiles/${fan.real.id}/rewards/receipts`, fan.token),
    ),
    receipts,
  );
});
