// Original controlled process fixtures. Never selected by the production parser.
import { once } from 'node:events';
const mode = process.argv[2];
const keepAlive = setTimeout(() => process.exit(9), 5000);
if (mode === 'output') {
  const chunk = Buffer.alloc(64 * 1024, 65);
  // Each stream stays below 8 MiB; their combined 9 MiB must trip the guard.
  for (let i = 0; i < 72; i++) {
    if (!process.stdout.write(chunk)) await once(process.stdout, 'drain');
    if (!process.stderr.write(chunk)) await once(process.stderr, 'drain');
  }
} else if (mode === 'memory') {
  const buffers = [];
  for (let i = 0; i < 52; i++) {
    buffers.push(Buffer.alloc(16 * 1024 * 1024, i + 1));
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  // Retain the touched external memory until the watchdog or finite timer stops us.
  keepAlive.refresh();
  setTimeout(() => process.exit(buffers.length === 52 ? 9 : 8), 1000);
} else if (mode === 'crash') {
  process.exit(7);
} else if (mode !== 'wait') {
  process.exit(8);
}
