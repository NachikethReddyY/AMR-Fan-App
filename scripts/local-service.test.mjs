import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import { runLocalService } from './local-service.mjs';

test('service survives an accelerated one-shot timeout and owner shutdown cleans only its child', async () => {
  const bounded = spawnSync(
    process.execPath,
    ['-e', 'setInterval(()=>{}, 1000)'],
    { timeout: 50, stdio: 'ignore' },
  );
  assert.equal(bounded.error?.code, 'ETIMEDOUT');
  const unrelated = spawn(
    process.execPath,
    ['-e', 'setInterval(()=>{}, 1000)'],
    { stdio: 'ignore' },
  );
  const controller = new AbortController();
  let child;
  try {
    const result = runLocalService(
      process.execPath,
      ['-e', 'setInterval(()=>{}, 1000)'],
      process.env,
      {
        signal: controller.signal,
        started: (process) => {
          child = process;
        },
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.ok(child?.pid);
    assert.equal(child.exitCode, null);
    controller.abort();
    await result;
    assert.ok(child.signalCode || child.exitCode !== null);
    assert.equal(unrelated.exitCode, null);
  } finally {
    unrelated.kill('SIGTERM');
    await once(unrelated, 'exit');
  }
});
