# Admin web delivery

The admin web app reuses the existing points, rewards, submission review, report
and interaction-session pages. Navigation links preserve their forms and layout.
The selected admin colors are `#081310` for the canvas and `#004A4D` for controls,
with a restrained lime current-page underline. The native fan app is separate.

## Build and publication boundary

Run `node scripts/build-admin.mjs <empty-output-directory>`. The default is
`dist/admin-vercel`; use a fresh directory for each candidate. The build copies
14 explicitly listed public HTML/CSS/JavaScript assets and generates `vercel.json`.
It refuses nonempty output so old secrets or foreign files cannot survive a rebuild.
No source server, tests, evidence, environment files, provider credentials, database,
function, addon or native app belongs in the deployment.

Deploy only this output directory, never the repository. The verified Hobby team
is `nachiketh-reddys-projects-beb7cce2`, project `amr-admin`, assigned domain
`https://amr-admin.vercel.app`. Verify the team plan and project before publishing.
This procedure uses static hosting and fixed external rewrites, with no paid
resource. No git integration or automated deployment is required.

Use `vercel deploy --cwd <output> --project amr-admin --scope <team> --dry
--json` and inspect the complete upload inventory: exactly the 15 public build
files. The explicit project flag avoids linking or downloading environment files
into the publication directory. Reject any extra file before deployment. After
independent review, run `vercel deploy --cwd <output> --project amr-admin --prod
--scope <team> --yes`. Record the exact source commit and returned URL; verify
the deployed pages and HTTP headers.

If an earlier `vercel link` created `.env.local`, treat it as a credential.
Remove only that generated file from the output without printing, hashing or
retaining its contents, then build into a fresh empty directory. Never upload
`.env*`, `.vercel`, private evidence or source credentials.

## API and authorization

All data requests use the existing Render API through explicitly listed fixed
rewrites. No client-controlled destination, Origin rewrite, general proxy,
cookie session or privileged CORS policy is added. API and HTML responses use
`no-store`. CSP permits scripts/styles only from self and connections only to
self and the fixed Supabase identity provider.

Keep Render's existing `ADMIN_ORIGIN` unchanged. The infrastructure owner sets
`ADMIN_ADDITIONAL_ORIGIN=https://amr-admin.vercel.app` only after the reviewed API
candidate is authorized for deployment. It accepts one exact origin, not a
comma-separated list or preview wildcard. Both values use the same startup
validation. Requests lacking Origin still pass the existing native/server
boundary and must satisfy ordinary authentication and authorization.

Supabase email/password login proves identity; application roles remain assigned
by the API database. A publishable key is retrieved from `/admin/config`; no
service-role key is built into the app. Login inputs omit native form names and use POST; a failed JavaScript handler
cannot serialize credentials into a URL or native form body. Tokens stay in page memory. Changing
sections or reloading therefore requires sign-in again. Finish any pending action
before leaving a section. Login does not create or grant an admin role.

## Verification and limits

Run `node --test scripts/admin-web.test.mjs server/auth/admin-origin.test.ts
server/auth/admin.test.mjs`, `pnpm check`, `pnpm security:check` and the isolated
`pnpm security:dast`. Database authorization checks include
`server/submissions/participation/admin/registration.database.test.ts` against
an owned disposable database. Browser checks use synthetic identities and the
actual API and prove navigation, fan rejection, assigned-admin reads and logout.

On the live site use read-only checks. Verify the login page, all navigation,
CSP, no-store, missing/invalid-session denial and exact-origin rejection. Do not
submit changes to real points, offers, reports or sessions as a smoke test.
Live assigned-admin reads require legitimate supplied access; synthetic local
proof cannot establish hosted admin readiness. The pinned Render release must
contain every API route the pages use. No claim of complete admin operations is
made while this backend dependency or legitimate access is missing.
