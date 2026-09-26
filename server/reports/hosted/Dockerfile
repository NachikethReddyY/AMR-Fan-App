FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e AS build
RUN apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev linux-libc-dev && rm -rf /var/lib/apt/lists/*
COPY server/reports/hosted/sandbox.c /sandbox.c
RUN gcc -O2 -Wall -Wextra -Werror -o /amr-pdf-sandbox /sandbox.c
FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --config.fetch-retries=0 --prod --frozen-lockfile --ignore-scripts
COPY --from=build /amr-pdf-sandbox /usr/local/bin/amr-pdf-sandbox
COPY server/reports/hosted/service.ts server/reports/hosted/runner.ts server/reports/hosted/trial-fixtures.ts ./server/reports/hosted/
COPY server/reports/hosted-protocol.ts server/reports/contracts.ts ./server/reports/
COPY server/reports/testing/fixtures.ts ./server/reports/testing/fixtures.ts
COPY server/accounts/types.ts ./server/accounts/types.ts
COPY server/ai/meaning.ts ./server/ai/meaning.ts
COPY server/reports/parser-worker.ts server/reports/contracts.ts /worker/server/reports/
COPY server/accounts/types.ts /worker/server/accounts/types.ts
COPY server/ai/meaning.ts /worker/server/ai/meaning.ts
COPY server/reports/hosted/probe.mjs /worker/probe.mjs
COPY package.json /worker/package.json
RUN ln -s /app/node_modules /worker/node_modules
USER node
CMD ["/bin/sh", "-c", "ulimit -c 0; exec node --max-old-space-size=128 server/reports/hosted/service.ts"]
