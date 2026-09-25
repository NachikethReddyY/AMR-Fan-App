import { spawn } from 'node:child_process';

/** A service has no wall-clock deadline. Its owner controls its process group. */
export async function runLocalService(
  program,
  args,
  env,
  { signal, started } = {},
) {
  const child = spawn(program, args, {
    env,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  });
  let stopping = false;
  let escalation;
  function terminate(name = 'SIGTERM') {
    if (!child.pid) return;
    try {
      if (process.platform === 'win32') child.kill(name);
      else process.kill(-child.pid, name);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
  function stop() {
    if (stopping) return;
    stopping = true;
    terminate();
    escalation = setTimeout(() => terminate('SIGKILL'), 5000);
    escalation.unref();
  }
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  signal?.addEventListener('abort', stop, { once: true });
  try {
    started?.(child);
    if (signal?.aborted) stop();
    await new Promise((resolve, reject) => {
      child.once('error', () =>
        reject(new Error('Local service could not start.')),
      );
      child.once('close', (code) =>
        code === 0 || stopping
          ? resolve()
          : reject(new Error('Local service failed.')),
      );
    });
  } finally {
    clearTimeout(escalation);
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    signal?.removeEventListener('abort', stop);
    terminate();
  }
}
