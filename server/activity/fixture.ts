// Canonical pixels of the 10x10 teal JPEG supplied only by local test fixtures.
// This is a demo allowance, not visual recognition or real-world evidence.
const LOCAL_FIXTURE_FINGERPRINT =
  'bdd0ccb18cf91b31247cbf474975bdc3c2cefb16fa05538209acfd6d69c54395';

export function isLocalAwardFixture(fingerprint: string, activity: string) {
  return fingerprint === LOCAL_FIXTURE_FINGERPRINT && activity === 'bus-trip';
}
