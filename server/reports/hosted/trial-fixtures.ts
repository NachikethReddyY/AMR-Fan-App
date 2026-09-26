import { syntheticPdf } from '../testing/fixtures.ts';
import { sourceHash } from '../hosted-protocol.ts';

/** Original, deterministic synthetic fixtures only. Every added fixture needs trial review. */
export const trialFixtures = [
  {
    name: 'unicode-two-pages',
    bytes: syntheticPdf([
      ['Synthetic water result 20 litres in 2025. 水'],
      ['Synthetic CO₂ target 10 tonnes by 2030. café'],
    ]),
  },
  {
    name: 'malformed',
    bytes: Buffer.from('%PDF-1.7\nsynthetic malformed fixture'),
  },
];
export const trialManifest = trialFixtures.map(({ name, bytes }) => ({
  name,
  sha256: sourceHash(bytes),
  bytes: bytes.length,
}));
