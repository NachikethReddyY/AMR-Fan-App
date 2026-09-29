import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
  randomUUID,
} from 'node:crypto';
import { ApiError } from '../accounts/types.ts';
import {
  MAX_FILE_BYTES,
  MAX_PAGES,
  MAX_TEXT_CHARACTERS,
  PARSER_VERSION,
  object,
  onlyKeys,
  uuid,
} from './contracts.ts';
import type { ParsedReport } from './parser.ts';

export const MAX_PARSER_OUTPUT = 8 * 1024 * 1024;
export const JOB_AUDIENCE = 'amr-report-parser-v1';
export const TRIAL_AUDIENCE = 'amr-report-parser-trial-v1';
type Audience = typeof JOB_AUDIENCE | typeof TRIAL_AUDIENCE;
export const sourceHash = (bytes: Buffer) =>
  createHash('sha256').update(bytes).digest('hex');
export function signJob(
  bytes: Buffer,
  privateKey: string,
  now = Date.now(),
  audience: Audience = JOB_AUDIENCE,
) {
  const key = createPrivateKey(privateKey);
  if (key.asymmetricKeyType !== 'ed25519')
    throw new Error('Use an Ed25519 parser signing key.');
  const job = {
    id: randomUUID(),
    audience,
    sha256: sourceHash(bytes),
    bytes: bytes.length,
    expiresAt: now + 60_000,
  };
  const payload = Buffer.from(JSON.stringify(job)).toString('base64url');
  return {
    job,
    token: `${payload}.${sign(null, Buffer.from(payload), key).toString('base64url')}`,
  };
}
export function verifyJob(
  token: string,
  publicKey: string,
  now = Date.now(),
  audience: Audience = JOB_AUDIENCE,
) {
  if (token.length > 2048) throw new ApiError(401, 'Invalid parser job.');
  const parts = token.split('.');
  const key = createPublicKey(publicKey);
  if (
    parts.length !== 2 ||
    key.asymmetricKeyType !== 'ed25519' ||
    !verify(
      null,
      Buffer.from(parts[0]),
      key,
      Buffer.from(parts[1], 'base64url'),
    )
  )
    throw new ApiError(401, 'Invalid parser job.');
  const value = object(
    JSON.parse(Buffer.from(parts[0], 'base64url').toString()),
  );
  onlyKeys(value, ['id', 'audience', 'sha256', 'bytes', 'expiresAt']);
  const id = uuid(value.id);
  if (
    value.audience !== audience ||
    typeof value.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.sha256) ||
    typeof value.bytes !== 'number' ||
    !Number.isSafeInteger(value.bytes) ||
    value.bytes < 8 ||
    value.bytes > MAX_FILE_BYTES ||
    typeof value.expiresAt !== 'number' ||
    !Number.isSafeInteger(value.expiresAt) ||
    value.expiresAt <= now ||
    value.expiresAt > now + 60_000
  )
    throw new ApiError(401, 'Invalid parser job.');
  return {
    id,
    sha256: value.sha256,
    bytes: value.bytes,
    expiresAt: value.expiresAt,
  };
}
export function parsedReport(value: unknown): ParsedReport {
  const result = object(value);
  onlyKeys(result, ['pages', 'parserVersion']);
  if (
    result.parserVersion !== PARSER_VERSION ||
    !Array.isArray(result.pages) ||
    result.pages.length < 1 ||
    result.pages.length > MAX_PAGES
  )
    throw new ApiError(422, 'Invalid parser result.');
  const pages = result.pages.map((entry: unknown, index: number) => {
    const page = object(entry);
    onlyKeys(page, ['page', 'text']);
    if (page.page !== index + 1 || typeof page.text !== 'string')
      throw new ApiError(422, 'Invalid parser page.');
    return { page: index + 1, text: page.text };
  });
  if (
    pages.reduce((sum, page) => sum + page.text.length, 0) >
      MAX_TEXT_CHARACTERS ||
    !pages.some((page) => page.text.trim())
  )
    throw new ApiError(422, 'Invalid parser text.');
  return { pages, parserVersion: PARSER_VERSION };
}
export async function boundedResponse(response: Response, max: number) {
  const reader = response.body?.getReader();
  if (!reader) throw new ApiError(503, 'Parser response is unavailable.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max)
        throw new ApiError(503, 'Parser response exceeds its limit.');
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
