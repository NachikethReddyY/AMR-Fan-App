import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { readOwnedProfile } from '../accounts/store.ts';
import { ApiError } from '../accounts/types.ts';
import { authenticateSession } from '../auth/session.ts';
import { transaction } from '../database/index.ts';
import { readContributions } from './store.ts';
import {
  parseOfficial,
  impactOverviewSchema,
  type ImpactOverview,
  type OfficialMetric,
  type OverviewImpactTotal,
} from './overview-contracts.ts';
import type { Contributions } from './contracts.ts';

const profileIdSchema = z.uuid();
const maxOverviewRows = 10000;

type ParticipationValues = {
  personal: {
    activityCount: number;
    missionsCompleted: number;
    pointsEarned: number;
  } | null;
  community: {
    activityCount: number;
    missionsCompleted: number;
  };
  profileKind: 'real' | 'demo';
};

type AggregateRow = {
  personal_activity_count: string | number | bigint;
  personal_missions_completed: string | number | bigint;
  personal_points_earned: string | number | bigint;
  community_activity_count: string | number | bigint;
  community_missions_completed: string | number | bigint;
};

type OfficialReader = (token: string) => Promise<unknown>;
type ReportRuntime = { official: OfficialReader };

function unavailableImpact(
  reason: 'source_unavailable' | 'demo_profile',
): OverviewImpactTotal {
  return { kind: 'unavailable', reasons: [reason] };
}

function safeCount(value: unknown, label: string): number {
  const number =
    typeof value === 'bigint'
      ? Number(value)
      : typeof value === 'number'
        ? value
        : typeof value === 'string' && /^\d+$/.test(value)
          ? Number(value)
          : NaN;
  if (
    !Number.isSafeInteger(number) ||
    number < 0 ||
    number > maxOverviewRows * maxOverviewRows
  )
    throw new ApiError(503, `Impact ${label} is temporarily unavailable.`);
  return number;
}

function isPropagating(error: unknown): boolean {
  return error instanceof ApiError && error.status < 500;
}

async function readParticipation(
  pool: Pool,
  token: string,
  profileId: string,
): Promise<ParticipationValues> {
  const actor = await authenticateSession(pool, token);
  const profile = await readOwnedProfile(pool, actor.principalId, profileId);
  return transaction(pool, async (client) => {
    await client.query(
      'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
    );
    await client.query("SET LOCAL statement_timeout = '5s'");
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const session = await client.query(
      'SELECT 1 FROM app.sessions WHERE token_hash=$1 AND principal_id=$2 AND revoked_at IS NULL AND expires_at>clock_timestamp()',
      [tokenHash, actor.principalId],
    );
    if (!session.rowCount) throw new ApiError(401, 'Sign in again.');
    const result = await client.query<AggregateRow>(
      `WITH real_claims AS (
         SELECT c.profile_id, c.operation_id
         FROM app.activity_reward_claims c
         JOIN app.profiles p ON p.id=c.profile_id AND p.kind='real'
         JOIN app.activity_assessments a ON a.id=c.assessment_id AND a.profile_id=c.profile_id AND a.status='accepted'
         WHERE c.source_context='production'
       ),
       mission_progress AS (
         SELECT me.profile_id, me.mission_id, SUM(me.delta)::bigint AS progress,
                md.target::bigint AS target
         FROM app.mission_events me
         JOIN app.mission_definitions md ON md.id=me.mission_id
         JOIN app.profiles p ON p.id=me.profile_id AND p.kind='real'
         JOIN app.activity_reward_claims c ON c.assessment_id=me.assessment_id AND c.profile_id=me.profile_id AND c.source_context='production'
         JOIN app.activity_assessments a ON a.id=me.assessment_id AND a.profile_id=me.profile_id AND a.status='accepted'
         WHERE me.source_context='production'
         GROUP BY me.profile_id, me.mission_id, md.target
       ),
       completed_missions AS (
         SELECT profile_id FROM mission_progress WHERE progress >= target
       )
       SELECT
         (SELECT count(*)::bigint FROM real_claims WHERE profile_id=$1) AS personal_activity_count,
         (SELECT count(*)::bigint FROM completed_missions WHERE profile_id=$1) AS personal_missions_completed,
         (SELECT COALESCE(sum(po.delta),0)::bigint
            FROM real_claims c
            JOIN app.points_operations po ON po.id=c.operation_id
           WHERE c.profile_id=$1 AND po.kind='activity_evidence' AND po.delta > 0) AS personal_points_earned,
         (SELECT count(*)::bigint FROM real_claims) AS community_activity_count,
         (SELECT count(*)::bigint FROM completed_missions) AS community_missions_completed`,
      [profileId],
    );
    if (result.rows.length !== 1 || result.rows[0] === undefined)
      throw new ApiError(
        503,
        'Impact participation is temporarily unavailable.',
      );
    const row = result.rows[0];
    const personal = {
      activityCount: safeCount(row.personal_activity_count, 'activity count'),
      missionsCompleted: safeCount(
        row.personal_missions_completed,
        'mission count',
      ),
      pointsEarned: safeCount(row.personal_points_earned, 'points'),
    };
    const community = {
      activityCount: safeCount(
        row.community_activity_count,
        'community activity count',
      ),
      missionsCompleted: safeCount(
        row.community_missions_completed,
        'community mission count',
      ),
    };
    return {
      profileKind: profile.kind,
      personal: profile.kind === 'real' ? personal : null,
      community,
    };
  });
}

function officialSection(rows: OfficialMetric[]) {
  const metrics = rows.filter((row) => row.sourceKind === 'permitted');
  return metrics.length
    ? { status: 'available' as const, metrics }
    : { status: 'empty' as const, metrics: [] as OfficialMetric[] };
}

function methodology(travel: Contributions | null, travelAvailable: boolean) {
  const records: {
    label: string;
    unit: string | null;
    period: string | null;
    method: string | null;
    assumptions: string | null;
    source: string | null;
  }[] = [
    {
      label: 'Activity participation',
      unit: 'activities',
      period: 'lifetime',
      method:
        'Count of credited photo activity rewards from live production records.',
      assumptions: 'Participation is not an environmental measurement.',
      source: null,
    },
    {
      label: 'Mission completion participation',
      unit: 'missions',
      period: 'lifetime',
      method:
        'Count of live qualifying mission event groups that reach each mission definition target.',
      assumptions: 'Synthetic and demo events are excluded.',
      source: null,
    },
    {
      label: 'Points participation',
      unit: 'points',
      period: 'lifetime',
      method: 'Sum of credited photo activity reward ledger deltas.',
      assumptions: 'Points are not CO2 and do not imply a carbon conversion.',
      source: null,
    },
  ];
  if (!travelAvailable || !travel) {
    records.push({
      label: 'Travel estimate',
      unit: 'kgCO2',
      period: 'lifetime',
      method: null,
      assumptions: 'Travel methodology is temporarily unavailable.',
      source: null,
    });
    return records;
  }
  for (const source of travel.sources) {
    records.push({
      label: source.id,
      unit: source.publishedUnit,
      period: source.period,
      method: source.method,
      assumptions: source.assumptions,
      source: source.source,
    });
  }
  return records;
}

export function composeImpactOverview({
  official,
  participation,
  travel,
}: {
  official:
    | { status: 'available' | 'empty'; metrics: OfficialMetric[] }
    | {
        status: 'unavailable';
        metrics: OfficialMetric[];
        reason: 'source_unavailable';
      };
  participation: ParticipationValues | null;
  travel: Contributions | null;
}): ImpactOverview {
  const profileKind = participation?.profileKind;
  const personalParticipation =
    profileKind === 'demo'
      ? { kind: 'unavailable' as const, reason: 'demo_profile' as const }
      : participation?.personal
        ? { kind: 'available' as const, ...participation.personal }
        : {
            kind: 'unavailable' as const,
            reason: 'source_unavailable' as const,
          };
  const communityParticipation = participation
    ? { kind: 'available' as const, ...participation.community }
    : { kind: 'unavailable' as const, reason: 'source_unavailable' as const };
  const personalTravel =
    travel?.personal ?? unavailableImpact('source_unavailable');
  const communityTravel =
    travel?.community ?? unavailableImpact('source_unavailable');
  return impactOverviewSchema.parse({
    official,
    fan: {
      personal: {
        participation: personalParticipation,
        travel: personalTravel,
      },
      community: {
        participation: communityParticipation,
        travel: communityTravel,
      },
    },
    travelMethodology: travel
      ? {
          kind: 'available',
          period: travel.period,
          unit: travel.unit,
          sources: travel.sources,
          validation: travel.validation,
        }
      : { kind: 'unavailable', reason: 'source_unavailable' },
    methodology: methodology(travel, travel !== null),
  });
}

export async function readImpactOverview({
  pool,
  token,
  profileId,
  reports,
  readOfficial,
}: {
  pool: Pool;
  token: string;
  profileId: string;
  reports?: ReportRuntime;
  readOfficial?: OfficialReader;
}): Promise<ImpactOverview> {
  const selected = profileIdSchema.parse(profileId);
  const officialReader =
    readOfficial ?? (reports ? reports.official : undefined);
  const settled = await Promise.allSettled([
    readContributions({ pool, token, profileId: selected }),
    readParticipation(pool, token, selected),
    officialReader
      ? officialReader(token).then(parseOfficial)
      : Promise.reject(new ApiError(503, 'Report source is unavailable.')),
  ]);
  const [travelResult, participationResult, officialResult] = settled;
  for (const result of settled) {
    if (result.status === 'rejected' && isPropagating(result.reason))
      throw result.reason;
  }
  const travel =
    travelResult.status === 'fulfilled' ? travelResult.value : null;
  const participation =
    participationResult.status === 'fulfilled'
      ? participationResult.value
      : null;
  const official =
    officialResult.status === 'fulfilled'
      ? officialSection(officialResult.value)
      : {
          status: 'unavailable' as const,
          metrics: [] as OfficialMetric[],
          reason: 'source_unavailable' as const,
        };
  return composeImpactOverview({ official, participation, travel });
}
