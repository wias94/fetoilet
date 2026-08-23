FROM node:22.14.0-bookworm
WORKDIR /app

ENV NPM_CONFIG_PRODUCTION=false
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV NITRO_PRESET=node-server
RUN npx vite build

EXPOSE 8080
CMD ["sh", "-c", "node scripts/migrate.mjs && node .output/server/index.mjs"]
