# Build context must be the repository root (see docker-compose.yml) so the @vtdesk/domain workspace is available
FROM oven/bun:1.4.2-alpine AS deps
WORKDIR /app

# Copy manifests only so the dependency layer is cached until a manifest changes
COPY package.json bun.lock ./
COPY packages/domain/package.json packages/domain/
COPY api/package.json api/
COPY web/package.json web/

RUN bun install --frozen-lockfile --production --filter @vtdesk/api

FROM oven/bun:1.4.2-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3001 \
    UPLOAD_DIR=/data/uploads

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/api/node_modules api/node_modules
COPY package.json ./
COPY packages/domain packages/domain
COPY api/package.json api/tsconfig.json api/
COPY api/src api/src

# Uploads live on a volume; the bun user must own it to write attachments
RUN mkdir -p "$UPLOAD_DIR" && chown -R bun:bun "$UPLOAD_DIR"

USER bun
WORKDIR /app/api

EXPOSE 3001
VOLUME ["/data/uploads"]

CMD ["bun", "src/server.ts"]
