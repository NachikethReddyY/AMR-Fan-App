FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e
RUN apt-get update && apt-get install -y --no-install-recommends postgresql ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY legacy/react-native/package.json legacy/react-native/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY services/api/package.json services/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/travel-domain/package.json packages/travel-domain/package.json
COPY packages/contracts packages/contracts
COPY packages/travel-domain packages/travel-domain
RUN corepack enable && pnpm install --frozen-lockfile --ignore-scripts
COPY services/api services/api
COPY apps/admin/pages apps/admin/pages
EXPOSE 3000
CMD ["node", "services/api/api/dast-start.ts"]
