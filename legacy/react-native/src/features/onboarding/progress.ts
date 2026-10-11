export function onboardingStage(
  introduced: boolean,
  signedIn: boolean,
  named: boolean,
) {
  if (!introduced) return 'intro';
  if (!signedIn) return 'account';
  return named ? 'complete' : 'name';
}
export function progressFraction(completed: number) {
  return Math.min(5, Math.max(0, completed)) / 5;
}
