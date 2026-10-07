import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
/** Public origin of the admin API. Repointing the API changes only this line. */
export const adminApiBase = 'https://bb-1.tailaf0363.ts.net/amr-api';
const sections = [
  ['points', ''],
  ['rewards', 'rewards/'],
  ['submissions', 'submissions/'],
  ['reports', 'reports/'],
  ['submissions/participation', 'participation/'],
];
/** Browser paths the deployed dashboard proxies to the admin API. */
export const adminApiPaths = [
  '/admin/config',
  '/v1/session',
  '/v1/me',
  '/v1/admin/session',
  '/v1/admin/points/profiles',
  '/v1/admin/points/adjustments',
  '/v1/admin/profiles/:id/points/history',
  '/v1/admin/rewards/offers',
  '/v1/admin/submissions',
  '/v1/admin/submissions/:id/decision',
  '/v1/submissions/ranking',
  '/v1/admin/submission-sessions',
  '/v1/admin/submission-sessions/:id/close',
  '/v1/admin/submission-selections/:id/resolve',
  '/v1/impact/official',
  '/v1/admin/reports',
  '/v1/admin/reports/:id',
  '/v1/admin/reports/:id/source',
  '/v1/admin/reports/:id/candidates',
  '/v1/admin/reports/:id/extractions',
  '/v1/admin/report-candidates/:id/revisions',
  '/v1/admin/report-candidates/:id/decisions',
];

/** Publish only the explicit browser asset list. Refuse stale/foreign output. */
export async function buildAdmin(destination) {
  await mkdir(destination, { recursive: true });
  if ((await readdir(destination)).length)
    throw new Error(
      'Admin output must be empty; use a fresh output directory.',
    );
  for (const [source, section] of sections) {
    const files = ['index.html', 'app.js'];
    if (['points', 'reports', 'submissions/participation'].includes(source))
      files.push('style.css');
    for (const file of files) {
      const target = resolve(destination, 'admin', section, file);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(
        resolve(
          root,
          'apps/admin/pages',
          source === 'submissions/participation' ? 'participation' : source,
          file,
        ),
        target,
      );
    }
  }
  await mkdir(resolve(destination, 'auth'), { recursive: true });
  await copyFile(
    resolve(root, 'services/api/auth/admin.js'),
    resolve(destination, 'auth/admin.js'),
  );
  const config = {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    framework: null,
    installCommand: '',
    buildCommand: '',
    outputDirectory: '.',
    redirects: [{ source: '/', destination: '/admin/', permanent: false }],
    rewrites: adminApiPaths.map((path) => ({
      source: path,
      destination: adminApiBase + path,
    })),
    headers: [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self' https://folakoxsilrfemctvlxj.supabase.co https://9dcdff78-04a7-49fc-90bd-e9c7b76e4774.ciamlogin.com https://amrfancustomers.ciamlogin.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
          },
        ],
      },
    ],
  };
  await writeFile(
    resolve(destination, 'vercel.json'),
    JSON.stringify(config, null, 2) + '\n',
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const destination = resolve(process.argv[2] ?? 'dist/admin-vercel');
  if (process.argv[2] === undefined)
    await rm(destination, { recursive: true, force: true });
  await buildAdmin(destination);
  console.log(`Admin public assets built in ${destination}`);
}
