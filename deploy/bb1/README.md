# BB-1 API host with Supabase PostgreSQL

This bundle runs the API on BB-1 and uses Supabase PostgreSQL for application
persistence. BB-1 binds the API to its LAN address on port `18080`; the native
phone APK can reach it without joining Tailscale. The API is the only component
that reads or writes users, points, journeys and impact data.

CIAM / Entra External ID remains the identity provider. Supabase Auth is not
used. The API validates CIAM access tokens with the issuer, audience, JWKS URL
and scope in `.env.example`, then maps the CIAM subject to `app.principals`.
These are public identity metadata; no provider credentials are copied into the
checkout.

AI inference is disabled by default. The API does not accept photo activity
submissions until a reviewed provider is configured, and the LUNA/LAYA URLs
remain loopback-only. Do not place provider keys in this directory or in the
repository.

On BB-1, from this directory:

```sh
install -d -m 700 /home/bb-1/.auth
# Create .env privately from .env.example with the Supabase session-pooler
# DATABASE_URL and BB-1 LAN address. Keep it mode 600.
# Copy Supabase's root CA to /home/bb-1/.auth/supabase-root-ca.pem.
chmod 600 .env /home/bb-1/.auth/supabase-root-ca.pem
docker compose build api
docker compose up -d api
curl --fail "http://${BB1_LAN_ADDRESS:?set BB1_LAN_ADDRESS}:18080/health"
curl --fail "http://${BB1_LAN_ADDRESS:?set BB1_LAN_ADDRESS}:18080/ready"
```

Keep provider credentials outside this checkout. The Compose API container reads
the optional `/home/bb-1/.auth/amr-onemap.env` and
`/home/bb-1/.auth/amr-ai.env` environment files and mounts the
`/home/bb-1/.auth` directory read-only at `/run/secrets/amr-private`.

For a OneMap account login, the `password` is the actual OneMap account
password. OneMap exchanges it with the email for a three-day access token. Create
`/home/bb-1/.auth/amr-onemap.env` with mode 600 using either of these forms:

```dotenv
# Account login. The canonical names are AMR_ONEMAP_EMAIL and AMR_ONEMAP_PASSWORD.
ONEMAP_EMAIL=your_registered_email
ONEMAP_EMAIL_PASSWORD=your_account_password

# Or an existing access token. The supplied ONEMAP_APIKKEY spelling is accepted.
# ONEMAP_EMAIL=your_registered_email
# ONEMAP_API_KEY=your_access_token
```

The app accepts the older `ONEMAP_APIKKEY`, `ONEMAP_API_EMAIL`, and
`ONEMAP_API_PASSWORD` names as aliases, so you do not need to rename an existing
secret. An access token is cached for the documented three-day lifetime unless
`ONEMAP_ACCESS_TOKEN_EXPIRES_AT` is supplied. Do not put an access token in a
`password` field.

If you prefer a JSON file, create `/home/bb-1/.auth/amr-onemap.json` with mode 600. It accepts the original `{ "email": "...", "password": "..." }` shape and
the supplied `ONEMAP_EMAIL` plus `ONEMAP_APIKKEY` shape. For a OneMap access token
in a plain file, use a mode-600
`/home/bb-1/.auth/amr-onemap-access-token.txt` and set the token-file variables
described in `docs/operations/routes.md`.

The BB-1 example uses the reviewed TokenRouter activity provider through the
server-only `/home/bb-1/.auth/amr-ai.env` configuration. Raw activity photos
remain transient and are never placed in Supabase Storage. The provider key is
never copied into this checkout or sent to the phone app.

The optional `amr-ai.env` file may contain server-only `LUNA_API_KEY` and
`TOKENROUTER_API_KEY` values. The TokenRouter adapter also accepts the supplied
`AI_API_KEY` and exact `AI_BASE_URL=https://api.tokenrouter.com/v1` aliases.
Keep `ACTIVITY_ASSESSMENT_ENABLED=false` until a reviewed activity provider is
installed; the current code keeps Luna/JEV inference disabled when that provider
boundary is absent.

The migration step is intentionally explicit and runs from a controlled
operator environment with the Supabase migration owner. Apply the repository's
ordered schema only during an authorized window after a backup or restore point
is confirmed. BB-1's runtime role is not allowed to alter the schema.

Supabase Storage is optional. If enabled, configure the server-only
`SUPABASE_STORAGE_KEY` and keep the private `amr-report-originals` bucket. It is
for approved retained report originals only. Activity photos remain transient
and are not stored.
