import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { assignRole, ensureAccount, renameProfile } from '../accounts/store.ts';
import { createSession, revokeSession } from '../auth/session.ts';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { adjustPoints, readPointsHistory } from '../points/index.ts';
import { dispatchRewards } from './http.ts';
import { offer as offerSchema } from './contracts.ts';
import {
  createOffer,
  editOffer,
  listAdminOffers,
  listOffers,
  purchaseReward,
  readContent,
  readOffer,
  readReceipts,
} from './index.ts';

if (
  process.env.NODE_ENV !== 'test' ||
  !/^\/amr_[a-f0-9]{12}_test$/.test(
    new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname,
  )
)
  throw new Error('Use this worktree disposable test database.');

const pool = createDatabase();
const issuer = `urn:amr:rewards-test:${randomUUID()}`;
before(() => migrate(pool));
after(() => pool.end());

async function account(subject: string, admin = false) {
  const value = await ensureAccount(pool, { issuer, subject });
  if (admin)
    await assignRole(pool, value.id, 'admin', 'Synthetic rewards test');
  const { token } = await createSession(pool, value.id);
  const real = value.profiles.find((profile) => profile.kind === 'real');
  const demo = value.profiles.find((profile) => profile.kind === 'demo');
  assert.ok(real && demo);
  return { ...value, token, real, demo };
}

test('fan buys one configured tree participation with one debit, History result and named retained receipt', async () => {
  const admin = await account('tree-admin', true);
  const fan = await account('tree-fan');
  await renameProfile(pool, fan.id, fan.real.id, 'Synthetic fan');
  await adjustPoints(pool, admin.token, {
    targetProfileId: fan.real.id,
    requestId: randomUUID(),
    delta: 250,
    reason: 'Synthetic purchase fixture',
  });
  const offer = await createOffer(pool, admin.token, {
    requestId: randomUUID(),
    enabled: true,
    product: {
      kind: 'tree',
      title: 'Synthetic programme participation',
      description: 'Demonstration only. No actual programme allocation.',
      pointsPrice: 100,
    },
  });
  const catalogue = await listOffers(pool, fan.token, fan.real.id);
  assert.ok(catalogue.offers.length > 0);
  assert.equal(offer.version, 1);
  const result = await purchaseReward(pool, fan.token, {
    profileId: fan.real.id,
    offerId: offer.id,
    offerVersion: offer.version,
    requestId: randomUUID(),
  });
  assert.equal(result.entry.delta, -100);
  assert.equal(result.entry.balanceAfter, 150);
  assert.equal(result.outcome.kind, 'tree');
  assert.equal(result.outcome.paidPoints, 100);
  assert.equal(result.outcome.fulfilment, 'demonstration');
  if (result.outcome.kind === 'tree')
    assert.equal(result.outcome.accountName, 'Synthetic fan');
  const history = await readPointsHistory(pool, fan.token, fan.real.id);
  assert.equal(history.balance, 150);
  assert.equal(history.entries.length, 2);
  assert.deepEqual(history.entries[0], result.entry);
  const receipts = await readReceipts(pool, fan.token, fan.real.id);
  assert.deepEqual(receipts.receipts, [result.outcome]);
  assert.equal(
    (await readReceipts(pool, fan.token, fan.demo.id)).receipts.length,
    0,
  );
});

async function fixture(name: string, points = 300) {
  const admin = await account(`${name}-admin`, true);
  const fan = await account(`${name}-fan`);
  if (points)
    await adjustPoints(pool, admin.token, {
      targetProfileId: fan.real.id,
      requestId: randomUUID(),
      delta: points,
      reason: 'Synthetic rewards fixture',
    });
  return { admin, fan };
}
const tree = {
  kind: 'tree',
  title: 'Synthetic participation',
  description: 'Demonstration, pending actual allocation.',
  pointsPrice: 100,
} as const;
function buyInput(profileId: string, offer: { id: string; version: number }) {
  return {
    profileId,
    offerId: offer.id,
    offerVersion: offer.version,
    requestId: randomUUID(),
  };
}

test('retained content survives edits and disablement; new-key acknowledgements and GET never duplicate rights or charge', async () => {
  const { admin, fan } = await fixture('content');
  const product = {
    kind: 'content',
    title: 'Synthetic notebook',
    description: 'Original demonstration content.',
    pointsPrice: 100,
    text: 'Synthetic story: A fan pauses on a walk and sketches a leaf.',
  } as const;
  const offer = await createOffer(pool, admin.token, {
    requestId: randomUUID(),
    enabled: true,
    product,
  });
  const input = buyInput(fan.real.id, offer);
  const first = await purchaseReward(pool, fan.token, input);
  const disabled = await editOffer(pool, admin.token, {
    requestId: randomUUID(),
    offerId: offer.id,
    expectedVersion: 1,
    enabled: false,
    product: {
      ...product,
      pointsPrice: 150,
      text: 'A later, different synthetic story.',
    },
  });
  assert.equal(disabled.version, 2);
  assert.deepEqual(await purchaseReward(pool, fan.token, input), first);
  const requests = Array.from({ length: 4 }, () =>
    buyInput(fan.real.id, offer),
  );
  const acknowledged = await Promise.all(
    requests.map((input) => purchaseReward(pool, fan.token, input)),
  );
  for (const result of acknowledged) {
    assert.equal(result.entry.delta, 0);
    assert.equal(result.entry.reason, 'Content already unlocked');
    assert.equal(result.entry.balanceAfter, 200);
    assert.deepEqual(result.outcome, first.outcome);
  }
  assert.deepEqual(
    await purchaseReward(pool, fan.token, requests[0]),
    acknowledged[0],
  );
  const content = await readContent(pool, fan.token, fan.real.id, offer.id);
  assert.equal(content.text, product.text);
  assert.deepEqual(content.receipt, first.outcome);
  await readContent(pool, fan.token, fan.real.id, offer.id);
  const history = await readPointsHistory(pool, fan.token, fan.real.id);
  assert.equal(history.balance, 200);
  assert.equal(history.entries.length, 6);
  assert.equal(history.entries.filter((entry) => entry.delta < 0).length, 1);
  assert.deepEqual(
    (await readReceipts(pool, fan.token, fan.real.id)).receipts,
    [first.outcome],
  );
  const other = await account('content-other');
  await assert.rejects(readContent(pool, other.token, fan.real.id, offer.id), {
    status: 404,
  });
  await assert.rejects(
    readContent(pool, other.token, other.real.id, offer.id),
    { status: 404 },
  );
  await assert.rejects(readContent(pool, fan.token, fan.demo.id, offer.id), {
    status: 404,
  });
  await assert.rejects(
    purchaseReward(pool, other.token, buyInput(other.real.id, disabled)),
    { status: 409 },
  );
  await assert.rejects(
    purchaseReward(pool, fan.token, { ...requests[0], offerVersion: 2 }),
    { status: 409 },
  );
});

test('stale or disabled offers and insufficient funds refuse without any partial debit or right', async () => {
  const { admin, fan } = await fixture('stale', 120);
  const offer = await createOffer(pool, admin.token, {
    requestId: randomUUID(),
    enabled: true,
    product: tree,
  });
  const input = buyInput(fan.real.id, offer);
  const edited = await editOffer(pool, admin.token, {
    requestId: randomUUID(),
    offerId: offer.id,
    expectedVersion: 1,
    enabled: true,
    product: { ...tree, pointsPrice: 150 },
  });
  await assert.rejects(purchaseReward(pool, fan.token, input), /Offer changed/);
  assert.equal(
    (await readOffer(pool, fan.token, fan.real.id, offer.id)).product
      .pointsPrice,
    150,
  );
  await assert.rejects(
    purchaseReward(pool, fan.token, buyInput(fan.real.id, edited)),
    /Insufficient points/,
  );
  const disabled = await editOffer(pool, admin.token, {
    requestId: randomUUID(),
    offerId: offer.id,
    expectedVersion: 2,
    enabled: false,
    product: tree,
  });
  await assert.rejects(
    purchaseReward(pool, fan.token, buyInput(fan.real.id, disabled)),
    /unavailable/,
  );
  await assert.rejects(
    purchaseReward(pool, fan.token, { ...input, offerId: randomUUID() }),
    { status: 404 },
  );
  assert.equal(
    (await readPointsHistory(pool, fan.token, fan.real.id)).balance,
    120,
  );
  assert.equal(
    (await readPointsHistory(pool, fan.token, fan.real.id)).entries.length,
    1,
  );
  assert.equal(
    (await readReceipts(pool, fan.token, fan.real.id)).receipts.length,
    0,
  );
});

test('tree and 10%/60% voucher purchases distinguish deliberate repeats from concurrent same-key replay', async () => {
  const { admin, fan } = await fixture('repeat', 700);
  for (const product of [
    tree,
    { ...tree, kind: 'discount', percentage: 10 },
    { ...tree, kind: 'discount', percentage: 60, pointsPrice: 150 },
  ]) {
    const offer = await createOffer(pool, admin.token, {
      requestId: randomUUID(),
      enabled: true,
      product,
    });
    const input = buyInput(fan.real.id, offer);
    const concurrent = await Promise.all(
      Array.from({ length: 4 }, () => purchaseReward(pool, fan.token, input)),
    );
    for (const result of concurrent) assert.deepEqual(result, concurrent[0]);
    const second = await purchaseReward(
      pool,
      fan.token,
      buyInput(fan.real.id, offer),
    );
    assert.notEqual(second.outcome.id, concurrent[0].outcome.id);
    assert.equal(second.outcome.fulfilment, 'demonstration');
    if (product.kind === 'discount' && second.outcome.kind === 'discount')
      assert.equal(second.outcome.percentage, product.percentage);
    const disabled = await editOffer(pool, admin.token, {
      requestId: randomUUID(),
      offerId: offer.id,
      expectedVersion: 1,
      enabled: false,
      product: { ...product, pointsPrice: 200 },
    });
    assert.equal(disabled.version, 2);
    assert.deepEqual(
      await purchaseReward(pool, fan.token, input),
      concurrent[0],
    );
  }
  assert.equal(
    (await readPointsHistory(pool, fan.token, fan.real.id)).balance,
    0,
  );
  assert.equal(
    (await readPointsHistory(pool, fan.token, fan.real.id)).entries.length,
    7,
  );
  assert.equal(
    (await readReceipts(pool, fan.token, fan.real.id)).receipts.length,
    6,
  );
});

test('mixed concurrent purchases cannot overspend one profile and a changed payload/key never bypasses binding', async () => {
  const { admin, fan } = await fixture('mixed', 150);
  const products = [
    tree,
    { ...tree, kind: 'discount', percentage: 60 },
    {
      ...tree,
      kind: 'content',
      text: 'Original synthetic demonstration paragraph.',
    },
  ];
  const offers = await Promise.all(
    products.map((product) =>
      createOffer(pool, admin.token, {
        requestId: randomUUID(),
        enabled: true,
        product,
      }),
    ),
  );
  const inputs = offers.map((offer) => buyInput(fan.real.id, offer));
  const outcomes = await Promise.allSettled(
    inputs.map((input) => purchaseReward(pool, fan.token, input)),
  );
  assert.equal(
    outcomes.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(
    outcomes.filter((result) => result.status === 'rejected').length,
    2,
  );
  assert.equal(
    (await readPointsHistory(pool, fan.token, fan.real.id)).balance,
    50,
  );
  assert.equal(
    (await readReceipts(pool, fan.token, fan.real.id)).receipts.length,
    1,
  );
  const winner = outcomes.findIndex((result) => result.status === 'fulfilled');
  const saved = outcomes[winner];
  assert.equal(saved.status, 'fulfilled');
  const original = inputs[winner];
  for (const change of [
    { offerId: offers[(winner + 1) % 3].id },
    { offerVersion: 2 },
    { profileId: fan.demo.id },
  ])
    await assert.rejects(
      purchaseReward(pool, fan.token, { ...original, ...change }),
      { status: 409 },
    );
  assert.equal(
    (await readPointsHistory(pool, fan.token, fan.demo.id)).balance,
    0,
  );
});

test('admin/fan ownership, role and session revocation remain authoritative even for replay', async () => {
  const { admin, fan } = await fixture('auth');
  const other = await account('auth-other');
  const creation = { requestId: randomUUID(), enabled: true, product: tree };
  await assert.rejects(createOffer(pool, fan.token, creation), { status: 403 });
  const offer = await createOffer(pool, admin.token, creation);
  assert.deepEqual(await createOffer(pool, admin.token, creation), offer);
  await assert.rejects(
    createOffer(pool, admin.token, { ...creation, enabled: false }),
    { status: 409 },
  );
  const input = buyInput(fan.real.id, offer);
  const paid = await purchaseReward(pool, fan.token, input);
  await assert.rejects(purchaseReward(pool, other.token, input), {
    status: 404,
  });
  await assert.rejects(readReceipts(pool, other.token, fan.real.id), {
    status: 404,
  });
  await assert.rejects(listOffers(pool, other.token, fan.real.id), {
    status: 404,
  });
  await assert.rejects(listAdminOffers(pool, fan.token), { status: 403 });
  await assignRole(pool, admin.id, 'fan', 'Synthetic role revocation');
  await assert.rejects(createOffer(pool, admin.token, creation), {
    status: 403,
  });
  await revokeSession(pool, fan.token);
  await assert.rejects(purchaseReward(pool, fan.token, input), { status: 401 });
  await assert.rejects(readReceipts(pool, fan.token, fan.real.id), {
    status: 401,
  });
  const resumed = await createSession(pool, fan.id);
  assert.deepEqual(await purchaseReward(pool, resumed.token, input), paid);
  for (const field of [
    'balance',
    'amount',
    'price',
    'actorId',
    'quantity',
    'role',
  ])
    await assert.rejects(
      purchaseReward(pool, resumed.token, { ...input, [field]: 1 }),
      { status: 400 },
    );
});

test('immutable paid receipts and purchased versions survive profile rename and manual balance correction', async () => {
  const { admin, fan } = await fixture('retained');
  const offer = await createOffer(pool, admin.token, {
    requestId: randomUUID(),
    enabled: true,
    product: tree,
  });
  const paid = await purchaseReward(
    pool,
    fan.token,
    buyInput(fan.real.id, offer),
  );
  await renameProfile(pool, fan.id, fan.real.id, 'Later synthetic name');
  await adjustPoints(pool, admin.token, {
    targetProfileId: fan.real.id,
    requestId: randomUUID(),
    delta: -200,
    reason: 'Synthetic correction',
  });
  assert.deepEqual(
    (await readReceipts(pool, fan.token, fan.real.id)).receipts,
    [paid.outcome],
  );
  for (const table of ['reward_receipts', 'reward_offer_versions']) {
    await assert.rejects(
      pool.query(
        `UPDATE app.${table} SET ${table === 'reward_receipts' ? 'receipt=receipt' : 'product=product'}`,
      ),
      { code: '23514' },
    );
    await assert.rejects(pool.query(`DELETE FROM app.${table}`), {
      code: '23514',
    });
    await assert.rejects(pool.query(`TRUNCATE app.${table} CASCADE`), {
      code: '23514',
    });
  }
  const anotherPool = createDatabase();
  try {
    assert.deepEqual(
      (await readReceipts(anotherPool, fan.token, fan.real.id)).receipts,
      [paid.outcome],
    );
  } finally {
    await anotherPool.end();
  }
});

test('confirmation shows server price/version and availability without leaking unpurchased text', async () => {
  const admin = await account('confirmation-admin', true);
  const fan = await account('confirmation-fan');
  const offer = await createOffer(pool, admin.token, {
    requestId: randomUUID(),
    enabled: true,
    product: {
      kind: 'content',
      title: 'Synthetic fan notebook',
      description: 'Original demonstration text.',
      pointsPrice: 75,
      text: 'Synthetic story: A fan writes down three things they noticed on a quiet walk.',
    },
  });
  const confirmation = await readOffer(pool, fan.token, fan.real.id, offer.id);
  assert.equal(confirmation.id, offer.id);
  assert.equal(confirmation.version, 1);
  assert.equal(confirmation.product.pointsPrice, 75);
  assert.equal(confirmation.enabled, true);
  assert.equal(Object.hasOwn(confirmation.product, 'text'), false);
  await assert.rejects(readOffer(pool, fan.token, randomUUID(), offer.id), {
    status: 404,
  });
  await assert.rejects(readOffer(pool, fan.token, fan.real.id, randomUUID()), {
    status: 404,
  });
});

test('the owned HTTP dispatcher composes catalogue, confirmation, purchase and retained access without owning transport guards', async () => {
  const { admin, fan } = await fixture('dispatcher', 200);
  const send = (
    token: string,
    method: string,
    path: string,
    value: Record<string, unknown> = {},
    query: Record<string, string> = {},
  ) =>
    dispatchRewards({
      pool,
      token,
      method,
      path,
      query,
      body: async () => value,
    });
  const create = await send(admin.token, 'POST', '/v1/admin/rewards/offers', {
    requestId: randomUUID(),
    enabled: true,
    product: {
      ...tree,
      kind: 'content',
      text: 'Original synthetic demonstration content.',
    },
  });
  assert.equal(create?.status, 201);
  const created = offerSchema.parse(create?.value);
  const base = `/v1/profiles/${fan.real.id}/rewards`;
  assert.equal((await send(fan.token, 'GET', `${base}/offers`))?.status, 200);
  assert.equal(
    (await send(fan.token, 'GET', `${base}/offers/${created.id}`))?.status,
    200,
  );
  const purchase = await send(
    fan.token,
    'POST',
    '/v1/rewards/purchases',
    buyInput(fan.real.id, created),
  );
  assert.equal(purchase?.status, 201);
  assert.equal((await send(fan.token, 'GET', `${base}/receipts`))?.status, 200);
  assert.equal(
    (await send(fan.token, 'GET', `${base}/content/${created.id}`))?.status,
    200,
  );
  assert.equal(
    (await send(admin.token, 'GET', '/v1/admin/rewards/offers'))?.status,
    200,
  );
  assert.equal(
    (
      await send(admin.token, 'PATCH', '/v1/admin/rewards/offers', {
        requestId: randomUUID(),
        offerId: created.id,
        expectedVersion: 1,
        enabled: false,
        product: created.product,
      })
    )?.status,
    200,
  );
  await assert.rejects(send(fan.token, 'GET', '/v1/admin/rewards/offers'), {
    status: 403,
  });
  await assert.rejects(
    send(fan.token, 'GET', `${base}/offers`, {}, { limit: '101' }),
    { status: 400 },
  );
  assert.equal(
    await send(fan.token, 'POST', `${base}/content/${created.id}`),
    null,
  );
  assert.equal(
    await send(fan.token, 'GET', `${base}/receipts/${created.id}`),
    null,
  );
});

test('simultaneous first content purchases with different keys create one paid right and one zero acknowledgement', async () => {
  const { admin, fan } = await fixture('first-content-race', 100);
  const offer = await createOffer(pool, admin.token, {
    requestId: randomUUID(),
    enabled: true,
    product: {
      ...tree,
      kind: 'content',
      text: 'Original synthetic race fixture.',
    },
  });
  const inputs = [buyInput(fan.real.id, offer), buyInput(fan.real.id, offer)];
  const results = await Promise.all(
    inputs.map((input) => purchaseReward(pool, fan.token, input)),
  );
  assert.deepEqual(
    results.map((result) => result.entry.delta).sort((a, b) => a - b),
    [-100, 0],
  );
  assert.deepEqual(results[0].outcome, results[1].outcome);
  const history = await readPointsHistory(pool, fan.token, fan.real.id);
  assert.equal(history.balance, 0);
  assert.equal(history.entries.length, 3);
  assert.equal(
    (await readReceipts(pool, fan.token, fan.real.id)).receipts.length,
    1,
  );
  const replays = await Promise.all(
    inputs.map((input) => purchaseReward(pool, fan.token, input)),
  );
  assert.deepEqual(replays, results);
  assert.equal(
    (await readPointsHistory(pool, fan.token, fan.real.id)).entries.length,
    3,
  );
});

test('demo purchases retain profile-owned rights without affecting the real profile or resuming with a new balance', async () => {
  const { admin, fan } = await fixture('demo', 0);
  await adjustPoints(pool, admin.token, {
    targetProfileId: fan.demo.id,
    requestId: randomUUID(),
    delta: 100,
    reason: 'Synthetic demo grant',
  });
  const offer = await createOffer(pool, admin.token, {
    requestId: randomUUID(),
    enabled: true,
    product: {
      ...tree,
      kind: 'content',
      text: 'Original synthetic demo-only content.',
    },
  });
  const saved = await purchaseReward(
    pool,
    fan.token,
    buyInput(fan.demo.id, offer),
  );
  assert.equal(saved.entry.balanceAfter, 0);
  assert.equal(
    (await readPointsHistory(pool, fan.token, fan.real.id)).entries.length,
    0,
  );
  await assert.rejects(readContent(pool, fan.token, fan.real.id, offer.id), {
    status: 404,
  });
  const resumed = await ensureAccount(pool, { issuer, subject: 'demo-fan' });
  const demo = resumed.profiles.find((profile) => profile.kind === 'demo');
  assert.equal(demo?.id, fan.demo.id);
  assert.equal(demo?.balance, 0);
  assert.deepEqual(
    (await readContent(pool, fan.token, fan.demo.id, offer.id)).receipt,
    saved.outcome,
  );
});
