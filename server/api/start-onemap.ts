import { startOneMap } from './onemap-secret.ts';

try {
  await startOneMap();
} catch {
  process.stderr.write('OneMap startup failed.\n');
  process.exit(1);
}
