FROM node:22.14.0-bookworm
WORKDIR /app

ENV NPM_CONFIG_PRODUCTION=false
ENV NODE_ENV=production

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
CMD ["sh", "-c", "node scripts/migrate.mjs; exec node .output/server/index.mjs"]
