import { readFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';

const assets = new Map([
  ['/admin/', { file: 'index.html', type: 'text/html; charset=utf-8' }],
  ['/admin/app.js', { file: 'app.js', type: 'text/javascript; charset=utf-8' }],
  ['/admin/style.css', { file: 'style.css', type: 'text/css; charset=utf-8' }],
]);

export function adminOrigin(value: string | undefined) {
  if (!value) return null;
  const url = new URL(value);
  if (
    url.origin !== value ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && url.hostname === '127.0.0.1'))
  )
    throw new Error(
      'ADMIN_ORIGIN must be an exact HTTPS origin or loopback HTTP origin.',
    );
  return value;
}

export async function serveAdmin(path: string, res: ServerResponse) {
  const asset = assets.get(path);
  if (!asset) return false;
  const bytes = await readFile(
    new URL(`./admin/${asset.file}`, import.meta.url),
  );
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  );
  res.writeHead(200, { 'Content-Type': asset.type });
  res.end(bytes);
  return true;
}
