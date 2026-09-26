import { createHash } from 'node:crypto';
import { ApiError } from '../accounts/types.ts';
import { SUPABASE_PROJECT_REF, SUPABASE_URL } from '../auth/supabase.ts';
import { MAX_FILE_BYTES, uuid } from './contracts.ts';
import type { SourceStorage } from './storage.ts';

const bucket = 'amr-report-originals';
const base = `${SUPABASE_URL}/storage/v1`;
const hash = (bytes: Buffer) =>
  createHash('sha256').update(bytes).digest('hex');
const unavailable = () =>
  new ApiError(503, 'Private report storage is unavailable.');
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw unavailable();
  return Object.fromEntries(Object.entries(value));
}
async function bounded(response: Response, limit: number) {
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel();
    throw unavailable();
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body?.getReader();
  if (!reader) throw unavailable();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw unavailable();
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

/** Provider access stays server-only; caller supplies a database advisory-lock transaction. */
export async function createSupabaseStorage({
  credential,
  exclusive,
  transport = fetch,
  quotaBytes = 256 * 1024 * 1024,
}: {
  credential: string;
  exclusive: <T>(operation: () => Promise<T>) => Promise<T>;
  transport?: typeof fetch;
  quotaBytes?: number;
}): Promise<SourceStorage> {
  try {
    if (credential.length > 16384) throw new Error();
    const parts = credential.split('.');
    if (parts.length !== 3) throw new Error();
    const claims = record(
      JSON.parse(Buffer.from(parts[1], 'base64url').toString()),
    );
    if (claims.role !== 'service_role' || claims.ref !== SUPABASE_PROJECT_REF)
      throw new Error();
  } catch {
    throw new Error(
      'A server-only credential for the exact Supabase project is required.',
    );
  }
  if (
    !Number.isSafeInteger(quotaBytes) ||
    quotaBytes < MAX_FILE_BYTES ||
    quotaBytes > 256 * 1024 * 1024
  )
    throw new Error('Invalid report storage quota.');
  async function request(
    path: string,
    signal: AbortSignal,
    init: RequestInit = {},
  ) {
    try {
      return await transport(base + path, {
        ...init,
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
        signal,
        headers: {
          apikey: credential,
          Authorization: `Bearer ${credential}`,
          ...init.headers,
        },
      });
    } catch {
      throw unavailable();
    }
  }
  const response = await request(
    `/bucket/${bucket}`,
    AbortSignal.timeout(5000),
  );
  if (!response.ok) {
    await response.body?.cancel();
    throw unavailable();
  }
  const config = record(
    JSON.parse((await bounded(response, 16384)).toString()),
  );
  if (
    config.id !== bucket ||
    config.public !== false ||
    config.file_size_limit !== MAX_FILE_BYTES
  )
    throw unavailable();
  async function original(
    id: string,
    signal: AbortSignal,
  ): Promise<Buffer | null> {
    const response = await request(
      `/object/authenticated/${bucket}/${id}.pdf`,
      signal,
    );
    if (response.status === 404) {
      await response.body?.cancel();
      return null;
    }
    if (response.status === 400) {
      let error: Record<string, unknown>;
      try {
        error = record(JSON.parse((await bounded(response, 16384)).toString()));
      } catch {
        throw unavailable();
      }
      // Storage's compatibility handler can put semantic 404 inside HTTP 400.
      if (
        (error.statusCode === '404' || error.statusCode === 404) &&
        error.code === 'NoSuchKey' &&
        (error.error === 'not_found' || error.error === 'NoSuchKey')
      )
        return null;
      throw unavailable();
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw unavailable();
    }
    return bounded(response, MAX_FILE_BYTES);
  }
  function same(bytes: Buffer, expectedHash: string) {
    if (hash(bytes) !== expectedHash)
      throw new ApiError(
        409,
        'Report source is immutable or its hash does not match.',
      );
    return bytes;
  }
  return {
    async list() {
      const signal = AbortSignal.timeout(15000);
      const entries: Awaited<ReturnType<SourceStorage['list']>> = [];
      let previous = '';
      // Finish the inventory before callers delete: deletion would shift offsets.
      for (let offset = 0; ; offset += 1000) {
        signal.throwIfAborted();
        const response = await request(`/object/list/${bucket}`, signal, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prefix: '',
            limit: 1000,
            offset,
            sortBy: { column: 'name', order: 'asc' },
          }),
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw unavailable();
        }
        let rows: unknown;
        try {
          rows = JSON.parse((await bounded(response, 512 * 1024)).toString());
        } catch {
          throw unavailable();
        }
        if (!Array.isArray(rows) || rows.length > 1000) throw unavailable();
        for (const entry of rows) {
          const row = record(entry);
          if (
            typeof row.name !== 'string' ||
            !/^[a-f0-9-]{36}\.pdf$/.test(row.name) ||
            typeof row.created_at !== 'string'
          )
            throw unavailable();
          if (row.name <= previous) throw unavailable();
          previous = row.name;
          const createdAt = Date.parse(row.created_at);
          if (!Number.isFinite(createdAt)) throw unavailable();
          entries.push({ id: uuid(row.name.slice(0, -4)), createdAt });
        }
        if (rows.length < 1000) return entries;
      }
    },
    async remove(id) {
      id = uuid(id);
      const signal = AbortSignal.timeout(15000);
      const response = await request(`/object/${bucket}`, signal, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: [`${uuid(id)}.pdf`] }),
      });
      await response.body?.cancel();
      if (!response.ok) throw unavailable();
      if (await original(id, signal)) throw unavailable();
    },
    async get(id, expectedHash) {
      uuid(id);
      if (!/^[a-f0-9]{64}$/.test(expectedHash))
        throw new ApiError(400, 'Invalid source hash.');
      const bytes = await original(uuid(id), AbortSignal.timeout(15000));
      if (!bytes) throw new ApiError(404, 'Source is not uploaded.');
      return same(bytes, expectedHash);
    },
    async put(id, bytes) {
      id = uuid(id);
      if (bytes.length > MAX_FILE_BYTES)
        throw new ApiError(413, 'PDF exceeds 10 MiB.');
      const sha256 = hash(bytes);
      return exclusive(async () => {
        const signal = AbortSignal.timeout(15000);
        const prior = await original(id, signal);
        if (prior) {
          same(prior, sha256);
          return { sha256, bytes: bytes.length };
        }
        const listed = await request(`/object/list/${bucket}`, signal, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prefix: '',
            limit: 1000,
            offset: 0,
            sortBy: { column: 'name', order: 'asc' },
          }),
        });
        if (!listed.ok) {
          await listed.body?.cancel();
          throw unavailable();
        }
        let entries: unknown;
        try {
          entries = JSON.parse((await bounded(listed, 512 * 1024)).toString());
        } catch {
          throw unavailable();
        }
        if (!Array.isArray(entries) || entries.length >= 1000)
          throw new ApiError(413, 'Report storage quota reached.');
        let used = 0;
        for (const entry of entries) {
          const row = record(entry),
            metadata = record(row.metadata);
          if (
            typeof row.name !== 'string' ||
            !/^[a-f0-9-]{36}\.pdf$/.test(row.name) ||
            typeof metadata.size !== 'number' ||
            !Number.isSafeInteger(metadata.size) ||
            metadata.size < 0
          )
            throw unavailable();
          used += metadata.size;
        }
        if (used + bytes.length > quotaBytes)
          throw new ApiError(413, 'Report storage quota reached.');
        const uploaded = await request(`/object/${bucket}/${id}.pdf`, signal, {
          method: 'POST',
          headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'false' },
          body: new Uint8Array(bytes),
        });
        await uploaded.body?.cancel();
        if (!uploaded.ok && uploaded.status !== 409) throw unavailable();
        const saved = await original(id, signal);
        if (!saved) throw unavailable();
        same(saved, sha256);
        return { sha256, bytes: bytes.length };
      });
    },
    // Atomic uploads have no partial files. Retention removes saved/expired originals explicitly.
    async cleanupIncomplete() {},
  };
}
