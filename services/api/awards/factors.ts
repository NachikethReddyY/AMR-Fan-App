import { fileURLToPath } from 'node:url';
import { loadFactorRelease } from './readiness.ts';

export function loadDefaultFactorRelease() {
  const config = loadFactorRelease(
    fileURLToPath(
      new URL('./factors/cag-surface-access-co2-v1.json', import.meta.url),
    ),
  );
  if (!config) throw new Error('Bundled factor release is missing.');
  return config;
}
