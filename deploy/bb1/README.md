# BB-1 API and AI pipeline host

This bundle runs the existing API and AI adapter boundary on BB-1 as an MVP
staging host. It keeps
Postgres private to BB-1's loopback interface and binds the API to the BB-1
Tailscale address on port `18080`.

AI inference is disabled by default. The API does not accept photo activity
submissions until a reviewed provider is configured, and the LUNA/LAYA URLs
remain loopback-only. Do not place provider keys in this directory or in the
repository.

On BB-1, from this directory:

```sh
install -d -m 700 secrets
umask 077
openssl rand -hex 32 > secrets/postgres_password
db_password=$(cat secrets/postgres_password)
sed -e "s#REPLACE_WITH_THE_SAME_VALUE_AS_THE_DB_SECRET#$db_password#" \
    -e "s#REPLACE_WITH_BB1_TAILSCALE_ADDRESS#${BB1_TAILSCALE_ADDRESS:?set BB1_TAILSCALE_ADDRESS}#" \
    .env.example > .env
chmod 600 .env
docker compose build api migrate
docker compose up -d db
docker compose run --rm migrate
docker compose up -d api
curl --fail "http://${BB1_TAILSCALE_ADDRESS:?set BB1_TAILSCALE_ADDRESS}:18080/health"
curl --fail "http://${BB1_TAILSCALE_ADDRESS:?set BB1_TAILSCALE_ADDRESS}:18080/ready"
```

The migration step is intentionally explicit. It applies the repository's
ordered schema once and does not seed accounts, points, or real activity data.
