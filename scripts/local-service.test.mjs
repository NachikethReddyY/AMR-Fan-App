import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { runLocalService } from './local-service.mjs';

test(
  'owner shutdown waits for a stubborn owned descendant after its wrapper exits',
  { skip: process.platform === 'win32' },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'amr-service-descendant-'));
    const pidFile = join(directory, 'descendant.pid');
    const unrelated = spawn(
      process.execPath,
      ['-e', 'setInterval(()=>{},1000)'],
      { stdio: 'ignore' },
    );
    const unrelatedExit = once(unrelated, 'exit');
    const controller = new AbortController();
    let wrapper;
    let descendant;
    try {
      const descendantCode = `import {writeFileSync} from 'node:fs'; process.on('SIGTERM',()=>{}); writeFileSync(${JSON.stringify(pidFile)},String(process.pid)); setInterval(()=>{},1000);`;
      const wrapperCode = `import {spawn} from 'node:child_process'; spawn(process.execPath,['--input-type=module','-e',${JSON.stringify(descendantCode)}],{stdio:'inherit'}); setInterval(()=>{},1000);`;
      const running = runLocalService(
        process.execPath,
        ['--input-type=module', '-e', wrapperCode],
        process.env,
        {
          signal: controller.signal,
          started: (child) => {
            wrapper = child.pid;
          },
        },
      );
      for (let attempt = 0; attempt < 100; attempt++) {
        try {
          descendant = Number(await readFile(pidFile, 'utf8'));
          break;
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
          await delay(20);
        }
      }
      assert.ok(descendant, 'descendant installed its SIGTERM handler');
      controller.abort();
      await running;
      assert.throws(
        () => process.kill(descendant, 0),
        { code: 'ESRCH' },
        'service may return only after its stubborn descendant is gone',
      );
      assert.doesNotThrow(() => process.kill(unrelated.pid, 0));
      assert.equal(unrelated.exitCode, null);
    } finally {
      controller.abort();
      for (const pid of [descendant, wrapper && -wrapper]) {
        if (pid)
          try {
            process.kill(pid, 'SIGKILL');
          } catch (error) {
            if (error.code !== 'ESRCH') throw error;
          }
      }
      unrelated.kill('SIGTERM');
      await unrelatedExit;
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test('normal success and nonzero exit keep their outcomes', async () => {
  await runLocalService(
    process.execPath,
    ['-e', 'process.exit(0)'],
    process.env,
  );
  await assert.rejects(
    runLocalService(process.execPath, ['-e', 'process.exit(7)'], process.env),
    /Local service failed/,
  );
});

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
