import { SUPABASE_URL } from '../auth/supabase.ts';
import { readFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
const assets = new Map([
  ['/admin/reports/', { file: 'index.html', type: 'text/html; charset=utf-8' }],
  [
    '/admin/reports/app.js',
    { file: 'app.js', type: 'text/javascript; charset=utf-8' },
  ],
  [
    '/admin/reports/style.css',
    { file: 'style.css', type: 'text/css; charset=utf-8' },
  ],
]);
export async function serveReportsAdmin(
  path: string,
  res: ServerResponse,
  supabaseSignIn = false,
): Promise<boolean> {
  const asset = assets.get(path);
  if (!asset) return false;
  const bytes = await readFile(
    new URL(`./admin/${asset.file}`, import.meta.url),
  );
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'${supabaseSignIn ? ` ${SUPABASE_URL}` : ''}; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
  );
  res.writeHead(200, { 'Content-Type': asset.type });
  res.end(bytes);
  return true;
}
