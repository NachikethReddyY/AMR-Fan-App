import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

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
  let stoppedAt;
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
    stoppedAt = performance.now();
    terminate();
    escalation = setTimeout(() => terminate('SIGKILL'), 5000);
  }
  function groupExists() {
    if (!child.pid) return false;
    if (process.platform === 'win32')
      return child.exitCode === null && child.signalCode === null;
    try {
      process.kill(-child.pid, 0);
      return true;
    } catch (error) {
      if (error.code === 'ESRCH') return false;
      throw error;
    }
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
    stop();
    try {
      // A wrapper can exit before its descendants. Keep escalation and the
      // owner alive until the entire owned group has terminated.
      while (groupExists()) {
        if (performance.now() - stoppedAt > 10000)
          throw new Error('Local service process group did not stop.');
        await delay(20);
      }
    } finally {
      clearTimeout(escalation);
      process.removeListener('SIGINT', stop);
      process.removeListener('SIGTERM', stop);
      signal?.removeEventListener('abort', stop);
    }
  }
}
