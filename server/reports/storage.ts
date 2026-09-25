import { constants } from 'node:fs';
import { mkdir, lstat, open, readdir, link, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { isAbsolute, join, parse, relative } from 'node:path';
import { ApiError } from '../accounts/types.ts';
import { MAX_FILE_BYTES, uuid } from './contracts.ts';

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const busyRoots = new Set<string>();
export type SourceStorage = Awaited<ReturnType<typeof createStorage>>;

export async function createStorage({
  root,
  quotaBytes = 256 * 1024 * 1024,
}: {
  root: string;
  quotaBytes?: number;
}) {
  if (
    !isAbsolute(root) ||
    !Number.isSafeInteger(quotaBytes) ||
    quotaBytes < MAX_FILE_BYTES
  )
    throw new Error('Invalid private report storage configuration.');
  let cursor = parse(root).root;
  for (const part of relative(cursor, root).split('/')) {
    cursor = join(cursor, part);
    try {
      await mkdir(cursor, { mode: 0o700 });
    } catch (error) {
      if (!(
        error instanceof Error &&
        'code' in error &&
        error.code === 'EEXIST'
      ))
        throw error;
    }
    const entry = await lstat(cursor);
    if (!entry.isDirectory() || entry.isSymbolicLink())
      throw new Error('Report storage requires real directories.');
  }
  if (((await lstat(root)).mode & 0o777) !== 0o700)
    throw new Error('Report storage must have mode 0700.');
  const filename = (id: string) => join(root, `${uuid(id)}.pdf`);
  async function get(id: string, expectedHash: string) {
    if (!/^[a-f0-9]{64}$/.test(expectedHash))
      throw new ApiError(400, 'Invalid source hash.');
    const handle = await open(
      filename(id),
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const info = await handle.stat();
      if (
        !info.isFile() ||
        info.size > MAX_FILE_BYTES ||
        (info.mode & 0o777) !== 0o600
      )
        throw new Error('Invalid stored source.');
      const bytes = await handle.readFile();
      if (sha(bytes) !== expectedHash)
        throw new ApiError(409, 'Stored source hash does not match.');
      return bytes;
    } finally {
      await handle.close();
    }
  }
  return {
    get,
    async put(id: string, bytes: Buffer) {
      const final = filename(id);
      if (bytes.length > MAX_FILE_BYTES)
        throw new ApiError(413, 'PDF exceeds 10 MiB.');
      const sha256 = sha(bytes);
      try {
        await get(id, sha256);
        return { sha256, bytes: bytes.length };
      } catch (error) {
        if (!(
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT'
        )) {
          if (error instanceof ApiError && error.status === 409)
            throw new ApiError(409, 'Report source is immutable.');
          throw error;
        }
      }
      if (busyRoots.has(root))
        throw new ApiError(503, 'Report storage is busy.');
      busyRoots.add(root);
      const temp = join(root, `.partial-${randomUUID()}`);
      try {
        let used = 0;
        for (const name of await readdir(root)) {
          const info = await lstat(join(root, name));
          if (!info.isFile() || info.isSymbolicLink())
            throw new Error('Unexpected report storage entry.');
          used += info.size;
        }
        if (used + bytes.length > quotaBytes)
          throw new ApiError(413, 'Report storage quota reached.');
        const handle = await open(temp, 'wx', 0o600);
        try {
          await handle.writeFile(bytes);
          await handle.sync();
        } finally {
          await handle.close();
        }
        try {
          await link(temp, final);
        } catch (error) {
          if (!(
            error instanceof Error &&
            'code' in error &&
            error.code === 'EEXIST'
          ))
            throw error;
          try {
            await get(id, sha256);
          } catch {
            throw new ApiError(409, 'Report source is immutable.');
          }
        }
        return { sha256, bytes: bytes.length };
      } finally {
        await unlink(temp).catch((error) => {
          if (error.code !== 'ENOENT') throw error;
        });
        busyRoots.delete(root);
      }
    },
    async cleanupIncomplete() {
      if (busyRoots.has(root))
        throw new ApiError(503, 'Report storage is busy.');
      for (const name of await readdir(root)) {
        if (!/^\.partial-[a-f0-9-]{36}$/.test(name)) continue;
        const path = join(root, name);
        const info = await lstat(path);
        if (
          info.isFile() &&
          !info.isSymbolicLink() &&
          Date.now() - info.mtimeMs > 60000
        )
          await unlink(path);
      }
    },
  };
}
