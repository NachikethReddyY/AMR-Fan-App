import { loadAwardRelease, loadFactorRelease } from '../awards/readiness.ts';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import type { Pool } from 'pg';
import {
  ensureAccount,
  readAccount,
  readOwnedProfile,
  updateProfile,
} from '../accounts/store.ts';
import { ApiError, type Identity } from '../accounts/types.ts';
import { authConfig } from '../auth/config.ts';
import { createIdentityVerifier } from '../auth/oidc.ts';
import {
  createSupabaseVerifier,
  supabaseBrowserConfig,
} from '../auth/supabase.ts';
import { readFile } from 'node:fs/promises';
import {
  authenticateSession,
  createSession,
  revokeSession,
} from '../auth/session.ts';
import {
  adjustPoints,
  readPointsHistory,
  listAdminProfiles,
} from '../points/index.ts';
import { adminOrigin, serveAdmin } from '../points/admin.ts';
import { createRouteQuery } from '../routes/query.ts';
import { createPlaceSearch } from '../routes/places.ts';
import { createRouteProvider } from '../routes/provider.ts';
import { createGoogleRouteBudget } from '../routes/google-budget.ts';
import { routeConfig } from '../routes/config.ts';
import { createJourneyService } from '../journeys/store.ts';
import { handleSubmissionRequest } from '../submissions/http.ts';
import { serveSubmissionAdmin } from '../submissions/admin.ts';
import { handleParticipationRequest } from '../submissions/participation-http.ts';
import { serveParticipationAdmin } from '../submissions/participation-admin.ts';
import { dispatchRewards, publicRewardsCatalogue } from '../rewards/http.ts';
import { serveRewardsAdmin } from '../rewards/admin.ts';
import { reportRuntime, isReportPath } from '../reports/runtime.ts';
import { handleReports } from '../reports/http.ts';
import { serveReportsAdmin } from '../reports/admin.ts';
import { readContributions } from '../impact/store.ts';
import { readImpactOverview } from '../impact/overview.ts';
import { createAwardsHandler } from '../awards/http.ts';
import { createPhotoHandler } from '../activity/http.ts';
import { planTransport } from '../transport/planner.ts';
import { createOsrmRouter } from '../transport/osrm.ts';
import { planInput } from '../transport/contracts.ts';
import { handleActivitySubmission } from '../activity/submission-http.ts';
import { createActivitySubmissionService } from '../activity/submission-service.ts';
import { enrollMission, listMissions } from '../activity/missions.ts';
import type { ActivitySubmissionProvider } from '../ai/activity-submission.ts';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const syntheticIdentities: Record<string, Identity> = {
  'fan-a': { issuer: 'urn:amr:local-synthetic', subject: 'fan-a' },
  'fan-b': { issuer: 'urn:amr:local-synthetic', subject: 'fan-b' },
};
const SESSION_COOKIE = 'amr_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
function bearer(req: IncomingMessage) {
  const value = req.headers.authorization;
  if (!value?.startsWith('Bearer ') || value.length > 16400)
    throw new ApiError(401, 'Sign in again.');
  return value.slice(7);
}
function sessionToken(req: IncomingMessage) {
  const authorization = req.headers.authorization;
  if (authorization) return bearer(req);
  const cookie = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const value = cookie?.slice(SESSION_COOKIE.length + 1);
  if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value))
    throw new ApiError(401, 'Sign in again.');
  return value;
}
function sessionCookie(token: string) {
  return `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
function clearedSessionCookie() {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
async function body(
  req: IncomingMessage,
  maxBytes = 4096,
): Promise<Record<string, unknown>> {
  if (req.headers['content-type'] !== 'application/json')
    throw new ApiError(415, 'Use application/json.');
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new ApiError(413, 'Request is too large.');
    chunks.push(Buffer.from(chunk));
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString());
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error();
    return Object.fromEntries(Object.entries(value));
  } catch {
    throw new ApiError(400, 'Invalid JSON object.');
  }
}
function onlyField(value: Record<string, unknown>, name: string) {
  if (Object.keys(value).length !== 1 || typeof value[name] !== 'string')
    throw new ApiError(400, `Only ${name} is accepted.`);
  return value[name];
}
function send(
  res: ServerResponse,
  status: number,
  value: unknown,
  headers: Record<string, string> = {},
) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
  res.end(JSON.stringify(value));
}

async function databaseReady(pool: Pool) {
  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      pool.query('SELECT 1 FROM app.principals LIMIT 1'),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('readiness timeout')),
          1000,
        );
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function createApi({
  pool,
  env = process.env,
  verifyIdentity,
  activityProvider,
}: {
  pool: Pool;
  env?: Record<string, string | undefined>;
  verifyIdentity?: (token: string) => Promise<Identity>;
  activityProvider?: ActivitySubmissionProvider;
}) {
  const config = authConfig(env);
  const adminAuth =
    config.kind === 'supabase'
      ? supabaseBrowserConfig(env.SUPABASE_PUBLISHABLE_KEY)
      : { mode: 'unavailable' };
  const browserOrigins = new Set([
    adminOrigin(env.ADMIN_ORIGIN),
    adminOrigin(env.ADMIN_ADDITIONAL_ORIGIN),
  ]);
  const awardConfig = loadAwardRelease(env.JOURNEY_AWARD_RELEASE_FILE);
  const factorConfig =
    loadFactorRelease(env.JOURNEY_FACTOR_RELEASE_FILE) ?? awardConfig;
  const queryRoutes = createRouteQuery({
    env,
    googleBudget:
      routeConfig(env).kind === 'google'
        ? createGoogleRouteBudget(pool)
        : undefined,
    factors: factorConfig?.factors,
    factorRelease: factorConfig?.release,
    calculationStatus: factorConfig ? 'approved' : 'indicative_demo',
  });
  const searchPlaces = createPlaceSearch(env);
  const liveRouteProvider =
    routeConfig(env).kind === 'onemap' ? createRouteProvider(env) : undefined;
  const transportRoadRouter = env.OSRM_BASE_URL
    ? createOsrmRouter(env.OSRM_BASE_URL)
    : undefined;
  const journeys = createJourneyService({
    pool,
    env,
    queryRoutes,
    awardConfig,
    factorConfig,
  });
  const reports = reportRuntime(pool, env);
  const awards = createAwardsHandler({ pool });
  const photoActivity = createPhotoHandler(pool, env);
  const activitySubmission = createActivitySubmissionService({
    pool,
    provider:
      activityProvider &&
      (env.NODE_ENV === 'test' || env.ACTIVITY_ASSESSMENT_ENABLED === 'true')
        ? activityProvider
        : undefined,
  });
  if (verifyIdentity && env.NODE_ENV !== 'test')
    throw new Error('Verifier injection is test-only.');
  const verifier =
    config.kind === 'oidc'
      ? (verifyIdentity ?? createIdentityVerifier(config))
      : config.kind === 'supabase'
        ? (verifyIdentity ?? createSupabaseVerifier())
        : null;
  // Fixed global window bounds both memory and authentication/JWKS/DB work.
  let windowStart = Date.now();
  let requests = 0;
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'",
    );
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const path = new URL(req.url ?? '/', 'http://api.invalid').pathname;
      if (req.method === 'GET' && path === '/auth/admin.js') {
        const bytes = await readFile(
          new URL('../auth/admin.js', import.meta.url),
        );
        res.writeHead(200, {
          'Content-Type': 'text/javascript; charset=utf-8',
        });
        res.end(bytes);
        return;
      }
      if (
        req.method === 'GET' &&
        (await serveAdmin(path, res, adminAuth.mode === 'supabase'))
      )
        return;
      if (
        req.method === 'GET' &&
        (await serveSubmissionAdmin(path, res, adminAuth.mode === 'supabase'))
      )
        return;
      if (
        req.method === 'GET' &&
        (await serveRewardsAdmin(path, res, adminAuth.mode === 'supabase'))
      )
        return;
      if (
        req.method === 'GET' &&
        (await serveReportsAdmin(path, res, adminAuth.mode === 'supabase'))
      )
        return;
      if (
        req.method === 'GET' &&
        (await serveParticipationAdmin(
          path,
          res,
          adminAuth.mode === 'supabase',
        ))
      )
        return;
      if (req.method === 'GET' && (path === '/' || path === '/health'))
        return send(res, 200, { status: 'ok' });
      if (req.method === 'GET' && path === '/ready') {
        if (await databaseReady(pool))
          return send(res, 200, {
            status: 'ready',
            dependencies: { database: 'ok' },
          });
        return send(res, 503, {
          status: 'unavailable',
          dependencies: { database: 'unavailable' },
        });
      }
      if (Date.now() - windowStart >= 60000) {
        windowStart = Date.now();
        requests = 0;
      }
      if (++requests > 300) throw new ApiError(429, 'Try again shortly.');
      if (req.headers.origin && !browserOrigins.has(req.headers.origin))
        throw new ApiError(403, 'Browser access is not configured.');
      if (path === '/v1/transport/plan' && req.method === 'POST') {
        const parsed = planInput.safeParse(await body(req));
        if (!parsed.success) throw new ApiError(400, 'Invalid transport plan.');
        return send(
          res,
          200,
          await planTransport(parsed.data, {
            roadRouter: transportRoadRouter,
            liveRouteProvider,
            env: process.env,
          }),
        );
      }
      if (path === '/v1/locations/search' && req.method === 'POST') {
        const result = await searchPlaces(await body(req));
        return send(
          res,
          result.kind === 'places'
            ? 200
            : result.reason === 'invalid_input'
              ? 400
              : 503,
          result,
        );
      }
      if (path === '/admin/config' && req.method === 'GET')
        return send(res, 200, {
          synthetic: config.kind === 'synthetic',
          auth: adminAuth,
        });
      if (path === '/v1/dev/session' && req.method === 'POST') {
        if (config.kind !== 'synthetic') throw new ApiError(404, 'Not found.');
        const fixture = onlyField(await body(req), 'fixture');
        const identity = Object.hasOwn(syntheticIdentities, fixture)
          ? syntheticIdentities[fixture]
          : undefined;
        if (!identity) throw new ApiError(400, 'Select a local test account.');
        const account = await ensureAccount(pool, identity);
        const session = await createSession(pool, account.id);
        return send(
          res,
          201,
          { ...session, account },
          { 'Set-Cookie': sessionCookie(session.token) },
        );
      }
      if (path === '/v1/session' && req.method === 'POST') {
        if (!verifier)
          throw new ApiError(503, 'Live sign-in is not configured.');
        const identity = await verifier(bearer(req));
        const account = await ensureAccount(pool, identity);
        const session = await createSession(pool, account.id);
        return send(
          res,
          201,
          { ...session, account },
          { 'Set-Cookie': sessionCookie(session.token) },
        );
      }
      if (path === '/v1/rewards/offers' && req.method === 'GET') {
        const catalogue = await publicRewardsCatalogue(
          pool,
          Object.fromEntries(
            new URL(req.url ?? '/', 'http://api.invalid').searchParams,
          ),
        );
        return send(res, catalogue.status, catalogue.value);
      }
      const token = sessionToken(req);
      const photoResponse = await photoActivity(req, path);
      if (photoResponse)
        return send(res, photoResponse.status, photoResponse.body);
      const activitySubmissionResponse = await handleActivitySubmission({
        req,
        path,
        pool,
        token,
        service: activitySubmission,
      });
      if (activitySubmissionResponse)
        return send(
          res,
          activitySubmissionResponse.status,
          activitySubmissionResponse.body,
        );
      if (path === '/v1/missions' && req.method === 'GET') {
        const query = new URL(req.url ?? '/', 'http://api.invalid')
          .searchParams;
        if (
          [...query.keys()].some((key) => key !== 'profileId') ||
          query.getAll('profileId').length !== 1
        )
          throw new ApiError(400, 'Provide one profileId.');
        return send(
          res,
          200,
          await listMissions(pool, token, {
            profileId: query.get('profileId'),
          }),
        );
      }
      const missionEnrollment = /^\/v1\/missions\/([^/]+)\/enroll$/.exec(path);
      if (missionEnrollment && req.method === 'POST')
        return send(
          res,
          200,
          await enrollMission(
            pool,
            token,
            missionEnrollment[1],
            await body(req),
          ),
        );
      if (path === '/v1/impact/overview' && req.method === 'GET') {
        const query = new URL(req.url ?? '/', 'http://api.invalid')
          .searchParams;
        if (
          [...query.keys()].some((key) => key !== 'profileId') ||
          query.getAll('profileId').length !== 1 ||
          !uuid.test(query.get('profileId') ?? '')
        )
          throw new ApiError(400, 'Provide one valid profileId.');
        return send(
          res,
          200,
          await readImpactOverview({
            pool,
            token,
            profileId: query.get('profileId')!,
            readOfficial: async (officialToken) =>
              (await reports()).official(officialToken),
          }),
        );
      }
      const impactProfile = /^\/v1\/profiles\/([^/]+)\/impact$/.exec(path);
      if (impactProfile && req.method === 'GET')
        return send(
          res,
          200,
          await readContributions({ pool, token, profileId: impactProfile[1] }),
        );
      if (isReportPath(path)) {
        const actor = await authenticateSession(pool, token);
        if (path !== '/v1/impact/official' && actor.role !== 'admin')
          throw new ApiError(403, 'Assigned admin access required.');
        if (
          await handleReports({
            req,
            res,
            path,
            token,
            reports: await reports(),
          })
        )
          return;
      }
      const award = await awards({
        method: req.method,
        path,
        token,
        readBody: () => body(req),
      });
      if (award) return send(res, award.status, award.body);
      const submissionResult = await handleSubmissionRequest({
        pool,
        token,
        method: req.method,
        path,
        query: Object.fromEntries(
          new URL(req.url ?? '/', 'http://api.invalid').searchParams,
        ),
        body: () => body(req),
      });
      if (submissionResult)
        return send(res, submissionResult.status, submissionResult.value);
      const participationResult = await handleParticipationRequest({
        pool,
        token,
        method: req.method,
        path,
        query: Object.fromEntries(
          new URL(req.url ?? '/', 'http://api.invalid').searchParams,
        ),
        body: () => body(req),
      });
      if (participationResult)
        return send(res, participationResult.status, participationResult.value);
      const rewards = await dispatchRewards({
        pool,
        token,
        method: req.method,
        path,
        query: Object.fromEntries(
          new URL(req.url ?? '/', 'http://api.invalid').searchParams,
        ),
        body: () => body(req),
      });
      if (rewards) return send(res, rewards.status, rewards.value);
      if (path === '/v1/admin/points/profiles' && req.method === 'GET')
        return send(
          res,
          200,
          await listAdminProfiles(
            pool,
            token,
            Object.fromEntries(
              new URL(req.url ?? '/', 'http://api.invalid').searchParams,
            ),
          ),
        );
      if (path === '/v1/admin/points/adjustments' && req.method === 'POST')
        return send(res, 201, await adjustPoints(pool, token, await body(req)));
      const pointsMatch =
        /^\/v1\/(admin\/)?profiles\/([^/]+)\/points\/history$/.exec(path);
      if (pointsMatch && req.method === 'GET') {
        const query = Object.fromEntries(
          new URL(req.url ?? '/', 'http://api.invalid').searchParams,
        );
        return send(
          res,
          200,
          await readPointsHistory(
            pool,
            token,
            pointsMatch[2],
            query,
            pointsMatch[1] ? 'admin' : 'owner',
          ),
        );
      }
      const actor = await authenticateSession(pool, token);
      const journeyCollection = /^\/v1\/profiles\/([^/]+)\/journeys$/.exec(
        path,
      );
      if (journeyCollection && req.method === 'GET') {
        const query = new URL(req.url ?? '/', 'http://api.invalid')
          .searchParams;
        const keys = [...query.keys()];
        if (new Set(keys).size !== keys.length)
          throw new ApiError(400, 'Duplicate journey query parameter.');
        return send(
          res,
          200,
          await journeys.listOwned(
            token,
            journeyCollection[1],
            Object.fromEntries(query),
          ),
        );
      }
      if (path === '/v1/journeys/prepare' && req.method === 'POST')
        return send(
          res,
          201,
          await journeys.preparePlan(token, await body(req)),
        );
      const journeyMatch =
        /^\/v1\/journeys\/([^/]+)(?:\/(start|evidence|finish|assessment))?$/.exec(
          path,
        );
      if (journeyMatch) {
        const [, journeyId, action] = journeyMatch;
        if (req.method === 'GET' && (!action || action === 'assessment')) {
          const journey = await journeys.read(token, journeyId);
          return send(res, 200, action ? journey.assessment : journey);
        }
        if (req.method === 'POST') {
          if (action === 'start')
            return send(
              res,
              200,
              await journeys.start(token, journeyId, await body(req)),
            );
          if (action === 'evidence')
            return send(
              res,
              200,
              await journeys.appendEvidence(
                token,
                journeyId,
                await body(req, 32768),
              ),
            );
          if (action === 'finish')
            return send(
              res,
              200,
              await journeys.finish(token, journeyId, await body(req)),
            );
        }
      }
      if (path === '/v1/routes/query' && req.method === 'POST')
        return send(res, 200, await queryRoutes(actor, await body(req)));
      if (path === '/v1/session' && req.method === 'DELETE') {
        await revokeSession(pool, token);
        return send(
          res,
          200,
          { signedOut: true },
          { 'Set-Cookie': clearedSessionCookie() },
        );
      }
      if (path === '/v1/me' && req.method === 'GET')
        return send(res, 200, await readAccount(pool, actor.principalId));
      if (path === '/v1/admin/session' && req.method === 'GET') {
        if (actor.role !== 'admin')
          throw new ApiError(403, 'Assigned admin access required.');
        return send(res, 200, { role: actor.role });
      }
      const match = /^\/v1\/profiles\/([^/]+)$/.exec(path);
      if (match) {
        const id = match[1];
        if (!uuid.test(id)) throw new ApiError(404, 'Profile not found.');
        if (req.method === 'GET')
          return send(
            res,
            200,
            await readOwnedProfile(pool, actor.principalId, id),
          );
        if (req.method === 'PATCH') {
          const fields = await body(req);
          const allowed = ['displayName', 'email', 'birthday'];
          const keys = Object.keys(fields);
          if (
            keys.length === 0 ||
            keys.length > allowed.length ||
            keys.some((key) => !allowed.includes(key))
          )
            throw new ApiError(
              400,
              'Only displayName, email and birthday are accepted.',
            );
          const patch: {
            displayName?: string;
            email?: string | null;
            birthday?: string | null;
          } = {};
          if ('displayName' in fields) {
            const name = fields.displayName;
            if (typeof name !== 'string')
              throw new ApiError(400, 'displayName must be a string.');
            const trimmed = name.trim();
            if (
              !trimmed ||
              trimmed.length > 80 ||
              /[\u0000-\u001f\u007f]/.test(trimmed)
            )
              throw new ApiError(
                400,
                'Use a name between 1 and 80 characters.',
              );
            patch.displayName = trimmed;
          }
          if ('email' in fields) {
            const email = fields.email;
            if (email !== null && typeof email !== 'string')
              throw new ApiError(400, 'email must be a string or null.');
            if (email === null || email.trim() === '') patch.email = null;
            else {
              const trimmed = email.trim();
              if (
                trimmed.length > 254 ||
                !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)
              )
                throw new ApiError(400, 'Use a valid email address.');
              patch.email = trimmed;
            }
          }
          if ('birthday' in fields) {
            const birthday = fields.birthday;
            if (birthday !== null && typeof birthday !== 'string')
              throw new ApiError(400, 'birthday must be a string or null.');
            if (birthday === null || birthday.trim() === '')
              patch.birthday = null;
            else {
              const trimmed = birthday.trim();
              const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
              const date = match
                ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]))
                : null;
              if (
                !match ||
                !date ||
                date.getUTCFullYear() !== +match[1] ||
                date.getUTCMonth() !== +match[2] - 1 ||
                date.getUTCDate() !== +match[3] ||
                +match[1] < 1900 ||
                date.getTime() > Date.now()
              )
                throw new ApiError(
                  400,
                  'Use a real birthday as YYYY-MM-DD, not in the future.',
                );
              patch.birthday = trimmed;
            }
          }
          return send(
            res,
            200,
            await updateProfile(pool, actor.principalId, id, patch),
          );
        }
      }
      throw new ApiError(404, 'Not found.');
    } catch (error) {
      if (!res.headersSent)
        send(res, error instanceof ApiError ? error.status : 500, {
          error:
            error instanceof ApiError
              ? error.message
              : 'The request could not be completed.',
        });
      else res.end();
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  return server;
}
