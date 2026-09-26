import { ApiError } from '../accounts/types.ts';
import type { authenticateSession } from '../auth/session.ts';
import { createRouteProvider, routeInput } from './provider.ts';
import {
  estimateRoute,
  singaporeFactors,
  type EmissionFactor,
} from '../../src/features/routes/emissions.ts';
import { recommendRoute } from '../../src/features/routes/recommendation.ts';
import type { RouteSnapshot } from '../journeys/contracts.ts';
import { boundarySource } from './geography.ts';

type Actor = Awaited<ReturnType<typeof authenticateSession>>;

// Construct once at API startup. The actor is supplied only by the merged
// authenticateSession boundary, never deserialized from the route request.
export function createRouteQuery({
  env = process.env,
  factors = singaporeFactors,
  calculationStatus = 'indicative_demo',
  factorRelease,
}: {
  env?: Record<string, string | undefined>;
  factors?: readonly EmissionFactor[];
  factorRelease?: RouteSnapshot['basis']['factorRelease'];
  calculationStatus?: 'indicative_demo' | 'approved';
} = {}) {
  const provider = createRouteProvider(env);
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
    // geography/method is unknown, preserve candidates and withhold comparison.
    const recommendation =
      result.kind !== 'routes'
        ? ({ kind: 'unavailable', reason: 'no_routes' } as const)
        : result.evidence.some(
              (item) => item.factorApplicability !== 'singapore_indicative',
            )
          ? ({
              kind: 'unavailable',
              reason: 'factor_applicability_unverified',
            } as const)
          : recommendRoute(result.routes, parsed.data.extraMinutes, factors);
    return {
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
  };
}
export type RouteQueryResult = Awaited<
  ReturnType<ReturnType<typeof createRouteQuery>>
>;
