FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e
WORKDIR /app
COPY server.mjs ./server.mjs
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
