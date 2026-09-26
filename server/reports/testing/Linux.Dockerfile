# Build only under the serialized local fixture grant. Never deploy this image.
FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e AS compiler
RUN apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev linux-libc-dev && rm -rf /var/lib/apt/lists/*
COPY server/reports/hosted/sandbox.c /sandbox.c
RUN gcc -O2 -Wall -Wextra -Werror -o /amr-pdf-sandbox /sandbox.c
FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e
RUN apt-get update && apt-get install -y --no-install-recommends postgresql ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --config.fetch-retries=0 --frozen-lockfile --ignore-scripts
# Explicit source allowlist. No host credential files, environment, evidence or peer mounts.
COPY server/accounts ./server/accounts
COPY server/auth ./server/auth
COPY server/database ./server/database
COPY server/ai ./server/ai
COPY server/points ./server/points
COPY server/reports ./server/reports
COPY --from=compiler /amr-pdf-sandbox /usr/local/bin/amr-pdf-sandbox
COPY server/reports/parser-worker.ts server/reports/contracts.ts /worker/server/reports/
COPY server/accounts/types.ts /worker/server/accounts/types.ts
COPY server/ai/meaning.ts /worker/server/ai/meaning.ts
COPY server/reports/hosted/probe.mjs /worker/probe.mjs
COPY package.json /worker/package.json
RUN ln -s /app/node_modules /worker/node_modules
CMD ["/bin/sh", "-c", "ulimit -c 0; exec node server/reports/testing/linux-runner.ts"]
