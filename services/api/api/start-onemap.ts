import { oneMapStartupFailure, startOneMap } from './onemap-secret.ts';

try {
  await startOneMap();
} catch (error) {
  process.stderr.write(JSON.stringify(oneMapStartupFailure(error)) + '\n');
  process.exit(1);
}
