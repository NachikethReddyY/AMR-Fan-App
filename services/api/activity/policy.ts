export function photoAward(decision: {
  verdict: string;
  confidence: number | null;
}): 0 | 50 {
  return decision.verdict === 'supported' &&
    decision.confidence !== null &&
    Number.isFinite(decision.confidence) &&
    decision.confidence > 0.5 &&
    decision.confidence <= 1
    ? 50
    : 0;
}

// Journey cumulative credit includes any photo preliminary already incorporated.
export function remainingJourneyAward(
  target: number,
  cumulative: number,
  preliminary: number,
) {
  return Math.max(0, target - Math.max(cumulative, preliminary));
}
