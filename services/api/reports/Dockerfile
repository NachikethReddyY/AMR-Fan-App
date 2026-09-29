FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e
WORKDIR /app
# Reuse the repository lock, including the exact PDF.js and optional canvas pins.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/fan/package.json apps/fan/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY services/api/package.json services/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/travel-domain/package.json packages/travel-domain/package.json
RUN corepack enable && pnpm install --prod --frozen-lockfile --ignore-scripts
COPY services/api/reports/parser-worker.ts services/api/reports/contracts.ts ./services/api/reports/
COPY services/api/accounts/types.ts ./services/api/accounts/types.ts
COPY services/api/ai/meaning.ts ./services/api/ai/meaning.ts
USER node
ENTRYPOINT ["node", "--max-old-space-size=384", "services/api/reports/parser-worker.ts"]
