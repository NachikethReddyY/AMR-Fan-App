import { readFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';

const assets = new Map([
  [
    '/admin/participation/',
    { file: 'index.html', type: 'text/html; charset=utf-8' },
  ],
  [
    '/admin/participation/app.js',
    { file: 'app.js', type: 'text/javascript; charset=utf-8' },
  ],
  [
    '/admin/participation/style.css',
    { file: 'style.css', type: 'text/css; charset=utf-8' },
  ],
]);

export async function serveParticipationAdmin(
  path: string,
  res: ServerResponse,
) {
  const asset = assets.get(path);
  if (!asset) return false;
  const bytes = await readFile(
    new URL(`./participation/admin/${asset.file}`, import.meta.url),
  );
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  );
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.writeHead(200, { 'Content-Type': asset.type });
  res.end(bytes);
  return true;
}
