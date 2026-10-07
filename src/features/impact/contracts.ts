import {
  parseOverview,
  parseOfficial,
  officialReportSchema,
  officialMetricSchema,
  impactOverviewSchema,
  type OfficialReport,
  type OfficialMetric,
  type ImpactOverview,
} from '../../../server/impact/overview-contracts.ts';
import { contributionsSchema } from '../../../server/impact/contracts.ts';

export {
  parseOverview,
  parseOfficial,
  officialReportSchema,
  officialMetricSchema,
  impactOverviewSchema,
};
export type { OfficialReport, OfficialMetric, ImpactOverview };

export function parseContributions(raw: unknown) {
  return contributionsSchema.parse(raw);
}
