FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e AS build
RUN apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev linux-libc-dev && rm -rf /var/lib/apt/lists/*
COPY services/api/reports/hosted/sandbox.c /sandbox.c
RUN gcc -O2 -Wall -Wextra -Werror -o /amr-pdf-sandbox /sandbox.c
FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/fan/package.json apps/fan/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY services/api/package.json services/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/travel-domain/package.json packages/travel-domain/package.json
RUN corepack enable && pnpm install --config.fetch-retries=0 --prod --frozen-lockfile --ignore-scripts
COPY --from=build /amr-pdf-sandbox /usr/local/bin/amr-pdf-sandbox
COPY services/api/reports/hosted/service.ts services/api/reports/hosted/runner.ts services/api/reports/hosted/trial-fixtures.ts ./services/api/reports/hosted/
COPY services/api/reports/hosted-protocol.ts services/api/reports/contracts.ts ./services/api/reports/
COPY services/api/reports/testing/fixtures.ts ./services/api/reports/testing/fixtures.ts
COPY services/api/accounts/types.ts ./services/api/accounts/types.ts
COPY services/api/ai/meaning.ts ./services/api/ai/meaning.ts
COPY services/api/reports/parser-worker.ts services/api/reports/contracts.ts /worker/services/api/reports/
COPY services/api/accounts/types.ts /worker/services/api/accounts/types.ts
COPY services/api/ai/meaning.ts /worker/services/api/ai/meaning.ts
COPY services/api/reports/hosted/probe.mjs /worker/probe.mjs
COPY package.json /worker/package.json
RUN ln -s /app/node_modules /worker/node_modules
USER node
CMD ["/bin/sh", "-c", "ulimit -c 0; exec node --max-old-space-size=128 services/api/reports/hosted/service.ts"]
