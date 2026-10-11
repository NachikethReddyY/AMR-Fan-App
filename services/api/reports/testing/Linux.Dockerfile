# Build only under the serialized local fixture grant. Never deploy this image.
FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e AS compiler
RUN apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev linux-libc-dev && rm -rf /var/lib/apt/lists/*
COPY services/api/reports/hosted/sandbox.c /sandbox.c
RUN gcc -O2 -Wall -Wextra -Werror -o /amr-pdf-sandbox /sandbox.c
FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e
RUN apt-get update && apt-get install -y --no-install-recommends postgresql ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY legacy/react-native/package.json legacy/react-native/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY services/api/package.json services/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/travel-domain/package.json packages/travel-domain/package.json
RUN corepack enable && pnpm install --config.fetch-retries=0 --frozen-lockfile --ignore-scripts
# Explicit source allowlist. No host credential files, environment, evidence or peer mounts.
COPY services/api/accounts ./services/api/accounts
COPY services/api/auth ./services/api/auth
COPY services/api/database ./services/api/database
COPY services/api/ai ./services/api/ai
COPY services/api/points ./services/api/points
COPY services/api/reports ./services/api/reports
COPY --from=compiler /amr-pdf-sandbox /usr/local/bin/amr-pdf-sandbox
COPY services/api/reports/parser-worker.ts services/api/reports/contracts.ts /worker/services/api/reports/
COPY services/api/accounts/types.ts /worker/services/api/accounts/types.ts
COPY services/api/ai/meaning.ts /worker/services/api/ai/meaning.ts
COPY services/api/reports/hosted/probe.mjs /worker/probe.mjs
COPY package.json /worker/package.json
RUN ln -s /app/node_modules /worker/node_modules
CMD ["/bin/sh", "-c", "ulimit -c 0; exec node services/api/reports/testing/linux-runner.ts"]
