# BB-1 API and AI pipeline host

This bundle runs the existing API and AI adapter boundary on BB-1 as an MVP
staging host. It keeps
Postgres private to BB-1's loopback interface and binds the API to the BB-1
LAN address on port `18080`. The native phone APK can reach this address without
joining Tailscale.

Authenticated native-app requests use the Entra External ID issuer, audience,
JWKS URL and scope in `.env.example`. These are public identity metadata; no
provider credentials are copied into the checkout.

AI inference is disabled by default. The API does not accept photo activity
submissions until a reviewed provider is configured, and the LUNA/LAYA URLs
remain loopback-only. Do not place provider keys in this directory or in the
repository.

On BB-1, from this directory:

```sh
install -d -m 700 /home/bb-1/.auth
install -d -m 700 secrets
umask 077
openssl rand -hex 32 > secrets/postgres_password
db_password=$(cat secrets/postgres_password)
sed -e "s#REPLACE_WITH_THE_SAME_VALUE_AS_THE_DB_SECRET#$db_password#" \
    -e "s#REPLACE_WITH_BB1_LAN_ADDRESS#${BB1_LAN_ADDRESS:?set BB1_LAN_ADDRESS}#" \
    .env.example > .env
chmod 600 .env
docker compose build api migrate
docker compose up -d db
docker compose run --rm migrate
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

The BB-1 example enables the explicit `synthetic` activity provider for the
MVP. It returns a bounded review candidate from transient image bytes so the
capture-to-points flow can be tested; it is not a live vision model. Replace
`ACTIVITY_ASSESSMENT_PROVIDER` with a reviewed provider before production.

The optional `amr-ai.env` file may contain server-only `LUNA_API_KEY` and
`TOKENROUTER_API_KEY` values. The TokenRouter adapter also accepts the supplied
`AI_API_KEY` and exact `AI_BASE_URL=https://api.tokenrouter.com/v1` aliases.
Keep `ACTIVITY_ASSESSMENT_ENABLED=false` until a reviewed activity provider is
installed; the current code keeps Luna/JEV inference disabled when that provider
boundary is absent.

The migration step is intentionally explicit. It applies the repository's
ordered schema once and does not seed accounts, points, or real activity data.
