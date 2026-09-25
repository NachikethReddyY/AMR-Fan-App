FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e
# Isolated scanner target only: PostgreSQL and the real API share a disposable container.
RUN apt-get update && apt-get install -y --no-install-recommends postgresql ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --ignore-scripts
COPY server ./server
EXPOSE 3000
CMD ["node", "server/api/dast-start.ts"]
