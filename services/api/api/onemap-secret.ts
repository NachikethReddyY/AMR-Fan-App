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

type FailureStage =
  | 'config'
  | 'temp_resolution'
  | 'source_resolution'
  | 'source_open'
  | 'source_metadata'
  | 'source_read'
  | 'source_format'
  | 'source_close'
  | 'private_dir'
  | 'copy_open'
  | 'copy_write'
  | 'copy_metadata'
  | 'copy_close'
  | 'staged_event'
  | 'api_import'
  | 'cleanup';

function safeErrno(error: unknown) {
  try {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? error.code
        : undefined;
    switch (code) {
      case 'ENOENT':
      case 'EACCES':
      case 'EPERM':
      case 'ELOOP':
      case 'ENOTDIR':
      case 'EISDIR':
      case 'EROFS':
      case 'ENOSPC':
      case 'EMFILE':
      case 'ENFILE':
      case 'EEXIST':
      case 'EIO':
        return code;
      default:
        return 'OTHER';
    }
  } catch {
    return 'OTHER';
  }
}

class StartupFailure extends Error {
  cleanupFailed = false;
  readonly stage: FailureStage;
  readonly errno: ReturnType<typeof safeErrno> | 'NONE';
  constructor(
    stage: FailureStage,
    errno: ReturnType<typeof safeErrno> | 'NONE',
  ) {
    super('OneMap token staging failed.');
    this.stage = stage;
    this.errno = errno;
  }
}

function failureAt(stage: FailureStage, error: unknown) {
  return error instanceof StartupFailure
    ? error
    : new StartupFailure(stage, safeErrno(error));
}

// Only our fixed fields cross stderr. Never serialize an original exception.
export function oneMapStartupFailure(error: unknown) {
  const failure = failureAt('api_import', error);
  return {
    event: 'onemap_startup_failed',
    stage: failure.stage,
    errno: failure.errno,
    ...(failure.cleanupFailed ? { cleanupFailed: true } : {}),
  };
}

// Source/base injection is for synthetic tests; the opt-in entrypoint accepts no overrides.
export function prepareOneMapSecret({
  source = mountedSource,
  temporaryBase = tmpdir(),
  env = process.env,
}: Options = {}) {
  let stage: FailureStage = 'config';
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
    } catch (error) {
      const failure = failureAt('cleanup', error);
      failure.message = 'OneMap private token cleanup failed.';
      throw failure;
    }
  };
  // A close failure must not replace the operation that already failed.
  function withDescriptor<T>(
    fd: number,
    closeStage: FailureStage,
    operation: () => T,
  ): T {
    let original: StartupFailure | undefined;
    try {
      return operation();
    } catch (error) {
      original = failureAt(stage, error);
      throw original;
    } finally {
      try {
        fs.closeSync(fd);
      } catch (error) {
        if (!original) throw failureAt(closeStage, error);
        original.cleanupFailed = true;
      }
    }
  }
  const buffer = Buffer.alloc(maxBytes + 1);
  try {
    if (
      !['disabled', 'onemap'].includes(env.AMR_ROUTES_PROVIDER ?? '') ||
      env.AMR_ONEMAP_CREDENTIALS_FILE ||
      env.AMR_ONEMAP_ACCESS_TOKEN_FILE ||
      env.AMR_GOOGLE_ROUTES_KEY ||
      env.AMR_ROUTES_SYNTHETIC === 'true'
    )
      throw new StartupFailure(stage, 'NONE');
    // Disabled staging validates the OneMap contract without changing the selected provider.
    const config = routeConfig({
      ...env,
      AMR_ROUTES_PROVIDER: 'onemap',
      AMR_ONEMAP_ACCESS_TOKEN_FILE: source,
    });
    if (config.kind !== 'onemap' || config.credentials.kind !== 'token-file')
      throw new StartupFailure(stage, 'NONE');
    stage = 'temp_resolution';
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
      throw new StartupFailure(stage, 'NONE');
    stage = 'source_resolution';
    // Only the fixed provider-managed mount may select a target through indirection.
    const target =
      source === mountedSource ? fs.realpathSync(mountedSource) : source;
    stage = 'source_open';
    const sourceFd = fs.openSync(
      target,
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK,
    );
    let bytes = 0;
    withDescriptor(sourceFd, 'source_close', () => {
      stage = 'source_metadata';
      const stat = fs.fstatSync(sourceFd);
      if (!stat.isFile() || stat.size < 1 || stat.size > maxBytes)
        throw new StartupFailure(stage, 'NONE');
      stage = 'source_read';
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
      stage = 'source_format';
      if (
        bytes > maxBytes ||
        !/^[A-Za-z0-9._~-]{1,8192}$/.test(
          buffer
            .subarray(0, bytes)
            .toString('utf8')
            .replace(/\r?\n$/, ''),
        )
      )
        throw new StartupFailure(stage, 'NONE');
    });
    stage = 'private_dir';
    directory = fs.mkdtempSync(join(base, 'amr-onemap-'));
    fs.chmodSync(directory, 0o700);
    const dirStat = fs.lstatSync(directory);
    if (
      !dirStat.isDirectory() ||
      dirStat.uid !== process.getuid?.() ||
      (dirStat.mode & 0o777) !== 0o700 ||
      fs.realpathSync(dirname(directory)) !== base
    )
      throw new StartupFailure(stage, 'NONE');
    path = join(directory, 'access-token.txt');
    stage = 'copy_open';
    const targetFd = fs.openSync(
      path,
      fs.constants.O_WRONLY |
        fs.constants.O_CREAT |
        fs.constants.O_EXCL |
        fs.constants.O_NOFOLLOW,
      0o600,
    );
    created = true;
    const metadata = withDescriptor(targetFd, 'copy_close', () => {
      stage = 'copy_write';
      let written = 0;
      while (written < bytes) {
        const count = fs.writeSync(targetFd, buffer, written, bytes - written);
        if (!count) throw new StartupFailure(stage, 'NONE');
        written += count;
      }
      stage = 'copy_metadata';
      const stat = fs.fstatSync(targetFd);
      if (
        !stat.isFile() ||
        stat.uid !== process.getuid?.() ||
        (stat.mode & 0o777) !== 0o600 ||
        stat.nlink !== 1 ||
        stat.size !== bytes
      )
        throw new StartupFailure(stage, 'NONE');
      return {
        uid: stat.uid,
        mode: stat.mode & 0o777,
        nlink: stat.nlink,
        directoryMode: dirStat.mode & 0o777,
      };
    });
    return { path, cleanup, metadata };
  } catch (error) {
    const failure = failureAt(stage, error);
    // routeConfig throws validation errors, with no operational errno.
    const reported =
      stage === 'config' && !(error instanceof StartupFailure)
        ? new StartupFailure('config', 'NONE')
        : failure;
    try {
      cleanup();
    } catch {
      reported.cleanupFailed = true;
    }
    throw reported;
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
  let stage: FailureStage = 'config';
  let copy: ReturnType<typeof prepareOneMapSecret> | undefined;
  let cleanupReported = false;
  const cleanup = () => {
    try {
      copy?.cleanup();
    } catch (error) {
      if (!cleanupReported) {
        cleanupReported = true;
        process.stderr.write(
          JSON.stringify(oneMapStartupFailure(failureAt('cleanup', error))) +
            '\n',
        );
      }
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
    stage = 'staged_event';
    env.AMR_ONEMAP_ACCESS_TOKEN_FILE = copy.path;
    process.stdout.write(
      JSON.stringify({
        event: 'onemap_token_staged',
        path: copy.path,
        ...copy.metadata,
        provider: env.AMR_ROUTES_PROVIDER,
      }) + '\n',
    );
    stage = 'api_import';
    await start();
  } catch (error) {
    const failure = failureAt(stage, error);
    try {
      copy?.cleanup();
    } catch {
      failure.cleanupFailed = true;
    }
    if (copy) delete env.AMR_ONEMAP_ACCESS_TOKEN_FILE;
    process.removeListener('exit', cleanup);
    failure.message = 'OneMap startup failed.';
    throw failure;
  } finally {
    // Once start.ts has installed its handlers, it owns graceful services/api/DB shutdown.
    process.removeListener('SIGTERM', term);
    process.removeListener('SIGINT', interrupt);
  }
}
