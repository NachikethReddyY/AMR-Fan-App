import { ApiError } from '../accounts/types.ts';
import { MAX_FILE_BYTES, object, onlyKeys } from './contracts.ts';
import {
  boundedResponse,
  MAX_PARSER_OUTPUT,
  parsedReport,
  signJob,
} from './hosted-protocol.ts';

/** Operator verification identifies the exact image that passed supported-host proof. */
export function createHostedParser({
  endpoint,
  signingKey,
  verifiedImage,
  transport = fetch,
}: {
  endpoint: string;
  signingKey: string;
  verifiedImage: string;
  transport?: typeof fetch;
}) {
  const url = new URL(endpoint);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    !/^sha256:[a-f0-9]{64}$/.test(verifiedImage)
  )
    throw new Error('Verified hosted parser configuration is required.');
  let active = false;
  async function request(path: string, init: RequestInit) {
    return transport(new URL(path, url), {
      ...init,
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
    });
  }
  return {
    async parse(bytes: Buffer) {
      if (bytes.length > MAX_FILE_BYTES)
        throw new ApiError(413, 'PDF exceeds 10 MiB.');
      if (!/^%PDF-(1\.[0-7]|2\.0)/.test(bytes.subarray(0, 8).toString('ascii')))
        throw new ApiError(415, 'Use a valid text-layer PDF.');
      if (active) throw new ApiError(503, 'Another report is being parsed.');
      active = true;
      try {
        const signal = AbortSignal.timeout(60_000);
        const ready = await request('/ready', { signal });
        if (!ready.ok) {
          await ready.body?.cancel();
          throw new Error();
        }
        const state = object(
          JSON.parse((await boundedResponse(ready, 4096)).toString()),
        );
        if (
          state.ready !== true ||
          state.image !== verifiedImage ||
          state.arch !== 'x64' ||
          state.isolation !== 'landlock-seccomp-v1'
        )
          throw new Error();
        const { job, token } = signJob(bytes, signingKey);
        const response = await request('/v1/parse', {
          method: 'POST',
          signal,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/pdf',
          },
          body: new Uint8Array(bytes),
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new ApiError(
            response.status === 422 ? 422 : 503,
            response.status === 422
              ? 'PDF could not be parsed.'
              : 'Hosted parser is unavailable. Retry shortly.',
          );
        }
        const value = object(
          JSON.parse(
            (await boundedResponse(response, MAX_PARSER_OUTPUT)).toString(),
          ),
        );
        onlyKeys(value, ['jobId', 'sha256', 'result']);
        if (value.jobId !== job.id || value.sha256 !== job.sha256)
          throw new Error();
        return parsedReport(value.result);
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(503, 'Hosted report processing is not ready.');
      } finally {
        active = false;
      }
    },
  };
}
