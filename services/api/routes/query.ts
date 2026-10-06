import { ApiError } from '../accounts/types.ts';
import type { authenticateSession } from '../auth/session.ts';
import { createRouteProvider, routeInput } from './provider.ts';
import {
  estimateRoute,
  singaporeFactors,
  type EmissionFactor,
} from '@amr/travel-domain/emissions';
import { recommendRoute } from '@amr/travel-domain/recommendation';
import { rankRouteChoice } from '../ai/jev-rank.ts';
import type { RouteSnapshot } from '../journeys/contracts.ts';
import { boundarySource } from './geography.ts';
import type { GoogleRouteBudget } from './google-budget.ts';

type Actor = Awaited<ReturnType<typeof authenticateSession>>;

// Construct once at API startup. The actor is supplied only by the merged
// authenticateSession boundary, never deserialized from the route request.
export function createRouteQuery({
  env = process.env,
  factors = singaporeFactors,
  calculationStatus = 'indicative_demo',
  factorRelease,
  googleBudget,
}: {
  env?: Record<string, string | undefined>;
  googleBudget?: GoogleRouteBudget;
  factors?: readonly EmissionFactor[];
  factorRelease?: RouteSnapshot['basis']['factorRelease'];
  calculationStatus?: 'indicative_demo' | 'approved';
} = {}) {
  const provider = createRouteProvider(env, googleBudget);
  let windowStart = Date.now();
  const accounts = new Map<string, number>();
  return async (actor: Actor | null, raw: unknown) => {
    if (!actor) throw new ApiError(401, 'Sign in again.');
    const parsed = routeInput.safeParse(raw);
    if (!parsed.success) throw new ApiError(400, 'Invalid route query.');
    if (Date.now() - windowStart >= 60000) {
      windowStart = Date.now();
      accounts.clear();
    }
    const used = accounts.get(actor.principalId) ?? 0;
    if (used >= 6 || (used === 0 && accounts.size >= 100))
      throw new ApiError(429, 'Try again shortly.');
    accounts.set(actor.principalId, used + 1);
    const result = await provider.search(parsed.data);
    const estimates =
      result.kind === 'routes'
        ? result.routes.map((route) => {
            const evidence = result.evidence.find(
              (item) => item.routeId === route.id,
            );
            const estimate =
              evidence?.factorApplicability === 'singapore_indicative'
                ? estimateRoute(route, factors)
                : ({
                    kind: 'unavailable',
                    reason:
                      evidence?.factorApplicability ?? 'geography_unverified',
                  } as const);
            return { routeId: route.id, estimate };
          })
        : [];
    // Never exclude a faster route to make another fit the time limit. Where
    // geography/method is unknown, compare only verified candidates and keep
    // every route available with its own estimate state.
    const verifiedIds =
      result.kind === 'routes'
        ? new Set(
            result.evidence
              .filter(
                (item) => item.factorApplicability === 'singapore_indicative',
              )
              .map((item) => item.routeId),
          )
        : new Set<string>();
    const recommendation =
      result.kind !== 'routes'
        ? ({ kind: 'unavailable', reason: 'no_routes' } as const)
        : verifiedIds.size === 0
          ? ({
              kind: 'unavailable',
              reason: 'factor_applicability_unverified',
            } as const)
          : recommendRoute(result.routes, parsed.data.extraMinutes, factors, {
              eligibleIds: verifiedIds,
            });
    // Jev ranks relative preference only; amounts stay code-calculated and
    // the deterministic recommendation above always stands as fallback.
    const queryResult = {
      query: parsed.data,
      result,
      estimates,
      recommendation,
      factors,
      geographySource: boundarySource,
      unsupportedModes: ['cab', 'electric_car'] as const,
      calculationStatus,
      ...(factorRelease
        ? {
            factorRelease: {
              version: factorRelease.version,
              factorFingerprint: factorRelease.factorFingerprint,
              geographyVersion: factorRelease.geographyVersion,
              factorEvidence: factorRelease.factorEvidence,
            },
          }
        : {}),
    };
    const jev = await rankRouteChoice(env, queryResult);
    // Drawable paths for options with continuous provider geometry. Routes
    // without it stay listed but draw nothing; never connect the gaps.
    const paths =
      result.kind !== 'routes'
        ? []
        : result.evidence.flatMap((item) =>
            item.geometry.kind === 'provider'
              ? [
                  {
                    routeId: item.routeId,
                    points: item.geometry.points,
                  },
                ]
              : [],
          );
    return { ...queryResult, paths, jev };
  };
}
export type RouteQueryResult = Awaited<
  ReturnType<ReturnType<typeof createRouteQuery>>
>;
