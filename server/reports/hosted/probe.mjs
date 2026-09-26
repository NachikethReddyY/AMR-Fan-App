import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { Socket } from 'node:net';
for (const path of [
  '/tmp/amr-parser-private-canary',
  '/proc/1/environ',
  '/proc/self/environ',
  '/app/server/reports/hosted/service.ts',
]) {
  assert.throws(() => readFileSync(path), { code: 'EACCES' });
}
assert.throws(
  () => writeFileSync('/tmp/amr-parser-forbidden-write', 'synthetic'),
  { code: 'EACCES' },
);
assert.deepEqual(Object.keys(process.env).sort(), ['LANG', 'NODE_ENV', 'PATH']);
await new Promise((resolve, reject) => {
  const socket = new Socket();
  socket.once('error', (error) => {
    socket.destroy();
    if (error.code === 'EPERM') resolve();
    else reject(error);
  });
  socket.once('connect', () => {
    socket.destroy();
    reject(new Error('Network allowed'));
  });
  socket.connect(9, '127.0.0.1');
});
process.stdout.write('isolated');
