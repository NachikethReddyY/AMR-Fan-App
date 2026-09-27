import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeConfig } from '../routes/config.ts';

const mountedSource = '/etc/secrets/amr-onemap-access-token.txt';
const maxBytes = 8194;
type Options = {
  source?: string;
  temporaryBase?: string;
  env?: Record<string, string | undefined>;
};

// Source/base injection is for synthetic tests; the opt-in entrypoint accepts no overrides.
export function prepareOneMapSecret({
  source = mountedSource,
  temporaryBase = tmpdir(),
  env = process.env,
}: Options = {}) {
  let directory: string | undefined;
  let path: string | undefined;
  let created = false;
  const cleanup = () => {
    try {
      if (created && path) {
        fs.unlinkSync(path);
        created = false;
      }
      if (directory) {
        fs.rmdirSync(directory);
        directory = undefined;
      }
    } catch {
      throw new Error('OneMap private token cleanup failed.');
    }
  };
  const buffer = Buffer.alloc(maxBytes + 1);
  try {
    if (
      !['disabled', 'onemap'].includes(env.AMR_ROUTES_PROVIDER ?? '') ||
      env.AMR_ONEMAP_CREDENTIALS_FILE ||
      env.AMR_ONEMAP_ACCESS_TOKEN_FILE ||
      env.AMR_GOOGLE_ROUTES_KEY ||
      env.AMR_ROUTES_SYNTHETIC === 'true'
    )
      throw new Error();
    // Disabled staging validates the OneMap contract without changing the selected provider.
    const config = routeConfig({
      ...env,
      AMR_ROUTES_PROVIDER: 'onemap',
      AMR_ONEMAP_ACCESS_TOKEN_FILE: source,
    });
    if (config.kind !== 'onemap' || config.credentials.kind !== 'token-file')
      throw new Error();
    const root = fs.realpathSync(
      fileURLToPath(new URL('../..', import.meta.url)),
    );
    const base = fs.realpathSync(temporaryBase);
    const location = relative(root, base);
    if (
      !location ||
      (location !== '..' &&
        !location.startsWith('../') &&
        !isAbsolute(location))
    )
      throw new Error();
    const sourceFd = fs.openSync(
      source,
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK,
    );
    let bytes = 0;
    try {
      const stat = fs.fstatSync(sourceFd);
      if (!stat.isFile() || stat.size < 1 || stat.size > maxBytes)
        throw new Error();
      while (bytes < buffer.length) {
        const read = fs.readSync(
          sourceFd,
          buffer,
          bytes,
          buffer.length - bytes,
          bytes,
        );
        if (!read) break;
        bytes += read;
      }
      if (
        bytes > maxBytes ||
        !/^[A-Za-z0-9._~-]{1,8192}$/.test(
          buffer
            .subarray(0, bytes)
            .toString('utf8')
            .replace(/\r?\n$/, ''),
        )
      )
        throw new Error();
    } finally {
      fs.closeSync(sourceFd);
    }
    directory = fs.mkdtempSync(join(base, 'amr-onemap-'));
    fs.chmodSync(directory, 0o700);
    const dirStat = fs.lstatSync(directory);
    if (
      !dirStat.isDirectory() ||
      dirStat.uid !== process.getuid?.() ||
      (dirStat.mode & 0o777) !== 0o700 ||
      fs.realpathSync(dirname(directory)) !== base
    )
      throw new Error();
    path = join(directory, 'access-token.txt');
    const targetFd = fs.openSync(
      path,
      fs.constants.O_WRONLY |
        fs.constants.O_CREAT |
        fs.constants.O_EXCL |
        fs.constants.O_NOFOLLOW,
      0o600,
    );
    created = true;
    let metadata: {
      uid: number;
      mode: number;
      nlink: number;
      directoryMode: number;
    };
    try {
      let written = 0;
      while (written < bytes) {
        const count = fs.writeSync(targetFd, buffer, written, bytes - written);
        if (!count) throw new Error();
        written += count;
      }
      const stat = fs.fstatSync(targetFd);
      if (
        !stat.isFile() ||
        stat.uid !== process.getuid?.() ||
        (stat.mode & 0o777) !== 0o600 ||
        stat.nlink !== 1 ||
        stat.size !== bytes
      )
        throw new Error();
      metadata = {
        uid: stat.uid,
        mode: stat.mode & 0o777,
        nlink: stat.nlink,
        directoryMode: dirStat.mode & 0o777,
      };
    } finally {
      fs.closeSync(targetFd);
    }
    return { path, cleanup, metadata };
  } catch {
    cleanup();
    throw new Error('OneMap token staging failed.');
  } finally {
    buffer.fill(0);
  }
}

export async function startOneMap({
  start = () => import('./start.ts'),
  ...options
}: Options & {
  start?: () => Promise<unknown>;
} = {}) {
  const env = options.env ?? process.env;
  let copy: ReturnType<typeof prepareOneMapSecret> | undefined;
  const cleanup = () => {
    try {
      copy?.cleanup();
    } catch {
      process.stderr.write('OneMap private token cleanup failed.\n');
      process.exitCode = 1;
    }
  };
  // Exit immediately during import so its pending work cannot resume after cleanup.
  const term = () => {
    cleanup();
    process.exit(143);
  };
  const interrupt = () => {
    cleanup();
    process.exit(130);
  };
  process.once('exit', cleanup);
  process.once('SIGTERM', term);
  process.once('SIGINT', interrupt);
  try {
    copy = prepareOneMapSecret({ ...options, env });
    env.AMR_ONEMAP_ACCESS_TOKEN_FILE = copy.path;
    process.stdout.write(
      JSON.stringify({
        event: 'onemap_token_staged',
        path: copy.path,
        ...copy.metadata,
        provider: env.AMR_ROUTES_PROVIDER,
      }) + '\n',
    );
    await start();
  } catch {
    cleanup();
    if (copy) delete env.AMR_ONEMAP_ACCESS_TOKEN_FILE;
    process.removeListener('exit', cleanup);
    throw new Error('OneMap startup failed.');
  } finally {
    // Once start.ts has installed its handlers, it owns graceful server/DB shutdown.
    process.removeListener('SIGTERM', term);
    process.removeListener('SIGINT', interrupt);
  }
}
