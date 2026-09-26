import { SUPABASE_URL } from '../auth/supabase.ts';
import { readFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';

const assets = new Map([
  ['/admin/rewards/', { file: 'index.html', type: 'text/html; charset=utf-8' }],
  [
    '/admin/rewards/app.js',
    { file: 'app.js', type: 'text/javascript; charset=utf-8' },
  ],
]);
export async function serveRewardsAdmin(
  path: string,
  res: ServerResponse,
  supabaseSignIn = false,
) {
  const asset = assets.get(path);
  if (!asset) return false;
  const bytes = await readFile(
    new URL(`./admin/${asset.file}`, import.meta.url),
  );
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'${supabaseSignIn ? ` ${SUPABASE_URL}` : ''}; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
  );
  res.writeHead(200, { 'Content-Type': asset.type });
  res.end(bytes);
  return true;
}
