import { createParser } from '../parser.ts';
import { parseIsolated } from '../hosted/runner.ts';

/** Test-only route through the actual Linux launcher, inside the leased disposable runner. */
export function reportTestParser() {
  if (process.env.REPORT_TEST_SANDBOX === 'landlock') {
    if (process.env.NODE_ENV !== 'test' || process.platform !== 'linux')
      throw new Error('Use the leased Linux report test runner.');
    return {
      parse: (bytes: Buffer) =>
        parseIsolated(bytes, AbortSignal.timeout(10_000)),
    };
  }
  return createParser({ dockerImage: process.env.REPORT_PARSER_IMAGE });
}
