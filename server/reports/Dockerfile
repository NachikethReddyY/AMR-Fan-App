FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e
WORKDIR /app
# Reuse the repository lock, including the exact PDF.js and optional canvas pins.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile --ignore-scripts
COPY server/reports/parser-worker.ts server/reports/contracts.ts ./server/reports/
COPY server/accounts/types.ts ./server/accounts/types.ts
COPY server/ai/meaning.ts ./server/ai/meaning.ts
USER node
ENTRYPOINT ["node", "--max-old-space-size=384", "server/reports/parser-worker.ts"]
