import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { lockOwnedProfile } from '../accounts/store.ts';
import { ApiError } from '../accounts/types.ts';
import { authenticateSession } from '../auth/session.ts';
import { transaction } from '../database/index.ts';
import { runPointsOperation } from '../points/index.ts';
import {
  createOfferInput,
  editOfferInput,
  offer,
  pageInput,
  parse,
  publicOffer,
  purchaseInput,
  receipt,
  uuid,
  type Offer,
  type Receipt,
} from './contracts.ts';

type Actor = Awaited<ReturnType<typeof authenticateSession>>;

// Catalogue administration and retained reads hold current role/session authority.
async function authorized<T>(
  pool: Pool,
  token: string,
  admin: boolean,
  action: (client: PoolClient, actor: Actor) => Promise<T>,
): Promise<T> {
  const actor = await authenticateSession(pool, token);
  return transaction(pool, async (client) => {
    const principal = await client.query<{ role: string }>(
      'SELECT role FROM app.principals WHERE id=$1 FOR SHARE',
      [actor.principalId],
    );
    if (admin && principal.rows[0]?.role !== 'admin')
      throw new ApiError(403, 'Assigned admin access required.');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const session = await client.query(
      `SELECT token_hash FROM app.sessions WHERE token_hash=$1 AND principal_id=$2
       AND revoked_at IS NULL AND expires_at > clock_timestamp() FOR SHARE`,
      [tokenHash, actor.principalId],
    );
    if (!session.rowCount) throw new ApiError(401, 'Sign in again.');
    // An unchanged row can wait after the locking SELECT evaluated expiry.
    const unexpired = await client.query(
      'SELECT 1 FROM app.sessions WHERE token_hash=$1 AND expires_at > clock_timestamp()',
      [tokenHash],
    );
    if (!unexpired.rowCount) throw new ApiError(401, 'Sign in again.');
    return action(client, actor);
  });
}

const offerColumns = 'v.offer_id AS id, v.version, v.enabled, v.product';
async function currentOffer(client: PoolClient, id: string) {
  // Purchases and edits serialize on the offer, after the purchase's profile lock.
  const locked = await client.query(
    'SELECT id FROM app.reward_offers WHERE id=$1 FOR UPDATE',
    [id],
  );
  if (!locked.rowCount) throw new ApiError(404, 'Reward offer not found.');
  const result = await client.query<Record<string, unknown>>(
    `SELECT ${offerColumns} FROM app.reward_offers o JOIN app.reward_offer_versions v
     ON v.offer_id=o.id AND v.version=o.current_version WHERE o.id=$1`,
    [id],
  );
  return offer.parse(result.rows[0]);
}

export async function createOffer(pool: Pool, token: string, value: unknown) {
  const input = parse(createOfferInput, value);
  return writeOffer(pool, token, input, null);
}
export async function editOffer(pool: Pool, token: string, value: unknown) {
  const input = parse(editOfferInput, value);
  return writeOffer(pool, token, input, {
    id: input.offerId,
    version: input.expectedVersion,
  });
}
async function writeOffer(
  pool: Pool,
  token: string,
  input: ReturnType<typeof createOfferInput.parse>,
  previous: { id: string; version: number } | null,
) {
  const fingerprint = createHash('sha256')
    .update(JSON.stringify([previous, input.enabled, input.product]))
    .digest('hex');
  return authorized(pool, token, true, async (client, actor) => {
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`rewards-catalogue:${actor.principalId}:${input.requestId}`],
    );
    const replay = await client.query<Record<string, unknown>>(
      `SELECT ${offerColumns}, v.fingerprint FROM app.reward_offer_versions v
       WHERE actor_id=$1 AND request_id=$2`,
      [actor.principalId, input.requestId],
    );
    if (replay.rows[0]) {
      const { fingerprint: saved, ...stored } = replay.rows[0];
      if (saved !== fingerprint)
        throw new ApiError(
          409,
          'Request key was already used for a different action.',
        );
      return offer.parse(stored);
    }
    let id: string;
    let version: number;
    if (previous) {
      const existing = await currentOffer(client, previous.id);
      if (existing.version !== previous.version)
        throw new ApiError(409, 'Offer changed. Reload before editing.');
      if (existing.product.kind !== input.product.kind)
        throw new ApiError(400, 'An offer cannot change reward type.');
      id = existing.id;
      version = existing.version + 1;
      await client.query(
        'UPDATE app.reward_offers SET current_version=$2 WHERE id=$1',
        [id, version],
      );
    } else {
      id = randomUUID();
      version = 1;
      await client.query(
        'INSERT INTO app.reward_offers(id,kind,current_version) VALUES ($1,$2,1)',
        [id, input.product.kind],
      );
    }
    const result = offer.parse({
      id,
      version,
      enabled: input.enabled,
      product: input.product,
    });
    await client.query(
      `INSERT INTO app.reward_offer_versions(offer_id,version,enabled,product,actor_id,request_id,fingerprint)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        id,
        version,
        input.enabled,
        JSON.stringify(input.product),
        actor.principalId,
        input.requestId,
        fingerprint,
      ],
    );
    return result;
  });
}

export async function listAdminOffers(
  pool: Pool,
  token: string,
  query: unknown = {},
) {
  const page = parse(pageInput, query);
  return authorized(pool, token, true, async (client) => {
    const rows = await client.query<Record<string, unknown>>(
      `SELECT ${offerColumns} FROM app.reward_offers o JOIN app.reward_offer_versions v
       ON v.offer_id=o.id AND v.version=o.current_version
       WHERE ($1::uuid IS NULL OR o.id > $1) ORDER BY o.id LIMIT $2`,
      [page.after ?? null, page.limit + 1],
    );
    const offers = rows.rows
      .slice(0, page.limit)
      .map((row) => offer.parse(row));
    return {
      offers,
      nextCursor: rows.rows.length > page.limit ? offers.at(-1)?.id : null,
    };
  });
}

export async function listOffers(
  pool: Pool,
  token: string,
  profileId: string,
  query: unknown = {},
) {
  const id = parse(uuid, profileId);
  const page = parse(pageInput, query);
  return authorized(pool, token, false, async (client, actor) => {
    await lockOwnedProfile(client, actor.principalId, id);
    return enabledCatalogue(client, page);
  });
}

// Public catalogue has no profile or principal authority and never exposes paid text.
export async function listPublicOffers(pool: Pool, query: unknown = {}) {
  const page = parse(pageInput, query);
  if (page.limit > 25) throw new ApiError(400, 'Invalid rewards request.');
  return enabledCatalogue(pool, page);
}
async function enabledCatalogue(
  client: Pick<Pool, 'query'> | Pick<PoolClient, 'query'>,
  page: ReturnType<typeof pageInput.parse>,
) {
  const rows = await client.query<Record<string, unknown>>(
    `SELECT ${offerColumns} FROM app.reward_offers o JOIN app.reward_offer_versions v
       ON v.offer_id=o.id AND v.version=o.current_version
       WHERE v.enabled AND ($1::uuid IS NULL OR o.id > $1) ORDER BY o.id LIMIT $2`,
    [page.after ?? null, page.limit + 1],
  );
  const offers = rows.rows
    .slice(0, page.limit)
    .map((row) => publicOffer(offer.parse(row)));
  return {
    offers,
    nextCursor: rows.rows.length > page.limit ? offers.at(-1)?.id : null,
  };
}

export async function readOffer(
  pool: Pool,
  token: string,
  profileId: string,
  offerId: string,
) {
  const id = parse(uuid, profileId);
  const target = parse(uuid, offerId);
  return authorized(pool, token, false, async (client, actor) => {
    await lockOwnedProfile(client, actor.principalId, id);
    return publicOffer(await currentOffer(client, target));
  });
}

export async function purchaseReward(
  pool: Pool,
  token: string,
  value: unknown,
) {
  const input = parse(purchaseInput, value);
  return runPointsOperation({
    pool,
    token,
    access: 'owner',
    request: {
      profileId: input.profileId,
      requestId: input.requestId,
      kind: 'reward_purchase',
    },
    intent: JSON.stringify([input.offerId, input.offerVersion]),
    outcomeSchema: receipt,
    perform: async ({ client, profile, operationId }) => {
      const owned = await client.query<{ receipt: unknown }>(
        "SELECT receipt FROM app.reward_receipts WHERE profile_id=$1 AND offer_id=$2 AND kind='content'",
        [profile.id, input.offerId],
      );
      // New-key acknowledgement binds intent without a second right or spend.
      if (owned.rows[0])
        return {
          delta: 0,
          reason: 'Content already unlocked',
          outcome: receipt.parse(owned.rows[0].receipt),
        };
      const selected = await currentOffer(client, input.offerId);
      if (!selected.enabled)
        throw new ApiError(409, 'Reward offer is unavailable.');
      if (selected.version !== input.offerVersion)
        throw new ApiError(
          409,
          'Offer changed. Review the current offer and confirm again.',
        );
      const outcome = makeReceipt(
        selected,
        profile.id,
        profile.displayName,
        operationId,
      );
      await client.query(
        `INSERT INTO app.reward_receipts(id,profile_id,offer_id,offer_version,kind,receipt)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          operationId,
          profile.id,
          selected.id,
          selected.version,
          outcome.kind,
          JSON.stringify(outcome),
        ],
      );
      return {
        delta: -outcome.paidPoints,
        reason: `Reward purchase: ${outcome.title}`,
        outcome,
      };
    },
  });
}

function makeReceipt(
  selected: Offer,
  profileId: string,
  accountName: string,
  id: string,
): Receipt {
  const common = {
    id,
    profileId,
    offerId: selected.id,
    offerVersion: selected.version,
    title: selected.product.title,
    paidPoints: selected.product.pointsPrice,
    purchasedAt: new Date().toISOString(),
  };
  switch (selected.product.kind) {
    case 'tree':
      return {
        ...common,
        kind: 'tree',
        accountName,
        fulfilment: 'demonstration',
      };
    case 'content':
      return { ...common, kind: 'content', fulfilment: 'unlocked' };
    case 'discount':
      return {
        ...common,
        kind: 'discount',
        percentage: selected.product.percentage,
        fulfilment: 'demonstration',
      };
  }
}

export async function readReceipts(
  pool: Pool,
  token: string,
  profileId: string,
  query: unknown = {},
) {
  const id = parse(uuid, profileId);
  const page = parse(pageInput, query);
  return authorized(pool, token, false, async (client, actor) => {
    await lockOwnedProfile(client, actor.principalId, id);
    const rows = await client.query<{ receipt: unknown }>(
      `SELECT receipt FROM app.reward_receipts WHERE profile_id=$1
       AND ($2::uuid IS NULL OR id > $2) ORDER BY id LIMIT $3`,
      [id, page.after ?? null, page.limit + 1],
    );
    const receipts = rows.rows
      .slice(0, page.limit)
      .map((row) => receipt.parse(row.receipt));
    return {
      receipts,
      nextCursor: rows.rows.length > page.limit ? receipts.at(-1)?.id : null,
    };
  });
}

export async function readContent(
  pool: Pool,
  token: string,
  profileId: string,
  offerId: string,
) {
  const id = parse(uuid, profileId);
  const target = parse(uuid, offerId);
  return authorized(pool, token, false, async (client, actor) => {
    await lockOwnedProfile(client, actor.principalId, id);
    const rows = await client.query<Record<string, unknown>>(
      `SELECT ${offerColumns}, r.receipt FROM app.reward_receipts r JOIN app.reward_offer_versions v
       ON v.offer_id=r.offer_id AND v.version=r.offer_version
       WHERE r.profile_id=$1 AND r.offer_id=$2 AND r.kind='content'`,
      [id, target],
    );
    const row = rows.rows[0];
    if (!row) throw new ApiError(404, 'Unlocked content not found.');
    const { receipt: saved, ...version } = row;
    const stored = offer.parse(version);
    if (stored.product.kind !== 'content')
      throw new Error('Invalid retained content version.');
    return { receipt: receipt.parse(saved), text: stored.product.text };
  });
}
