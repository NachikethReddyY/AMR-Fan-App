import { ApiError } from '../accounts/types.ts';
export const maxScanRows = 10_000;
const maxScanMs = 5_000;
export function checkScanBudget({
  rows,
  elapsedMs,
}: {
  rows: number;
  elapsedMs: number;
}) {
  if (rows > maxScanRows || elapsedMs >= maxScanMs)
    throw new ApiError(
      503,
      'Lifetime impact is temporarily unavailable. Try again later.',
    );
  return Math.max(1, Math.floor(maxScanMs - elapsedMs));
}

export function rethrowScanError(error: unknown): never {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '57014'
  )
    throw new ApiError(
      503,
      'Lifetime impact is temporarily unavailable. Try again later.',
    );
  throw error;
}
