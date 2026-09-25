// Child-process test preload. Never contacts a provider or opens a listener.
import assert from 'node:assert/strict';
import { appendFileSync, existsSync, promises } from 'node:fs';
import { mock } from 'node:test';

globalThis.fetch = async (url, options) => {
  assert.equal(String(url), 'http://127.0.0.1:1/v1/chat/completions');
  const body = JSON.parse(options.body);
  const route = body.messages[0].content.startsWith('Order');
  appendFileSync(
    process.env.AMR_TEST_CALLS,
    JSON.stringify({
      task: route ? 'route' : 'report',
      reserved: existsSync(process.env.AMR_TEST_OUTPUT),
    }) + '\n',
  );
  return Response.json({
    model: 'gpt-6-luna',
    choices: [
      {
        finish_reason: 'stop',
        message: {
          content: JSON.stringify(
            route
              ? { order: ['baseline', 'emissions', 'time'] }
              : { candidates: [] },
          ),
        },
      },
    ],
  });
};

if (process.env.AMR_TEST_WRITE_FAILURE === 'true') {
  const open = promises.open.bind(promises);
  mock.method(promises, 'open', async (...args) => {
    const handle = await open(...args);
    if (String(args[0]) === process.env.AMR_TEST_OUTPUT) {
      const write = handle.writeFile.bind(handle);
      mock.method(handle, 'writeFile', async () => {
        await write('partial test result');
        throw new Error('synthetic disk write failure');
      });
    }
    return handle;
  });
}
