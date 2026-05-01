FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=1536
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
ENV DATA_DIR=/data

RUN addgroup -S app && adduser -S app -G app

COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/.next ./.next
COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/package.json ./package.json
COPY --from=builder --chown=app:app /app/next.config.mjs ./next.config.mjs

# Persistent storage for user playlists. Bind-mount the host's ./data here:
#   docker run -v $(pwd)/data:/data ...
# Owned by `app` so the unprivileged process can write files.
RUN mkdir -p /data/playlists && chown -R app:app /data
VOLUME ["/data"]

RUN chown -R app:app /app
USER app

EXPOSE 3001
CMD ["pnpm", "start"]
