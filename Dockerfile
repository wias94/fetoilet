FROM node:22.14.0-bookworm
WORKDIR /app

ENV NPM_CONFIG_PRODUCTION=false
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV NITRO_PRESET=node-server
RUN npx vite build \
  && mkdir -p .output/server/_libs \
  && cp node_modules/@electric-sql/pglite/dist/pglite.data \
        node_modules/@electric-sql/pglite/dist/pglite.wasm \
        node_modules/@electric-sql/pglite/dist/initdb.wasm \
        .output/server/_libs/

EXPOSE 8080
# Listen first. Migrate in the background so Neon-down cannot fail healthcheck.
CMD ["sh", "-c", "node scripts/migrate.mjs & node scripts/history-worker.mjs & exec node .output/server/index.mjs"]
