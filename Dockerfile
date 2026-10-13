# syntax=docker/dockerfile:1
FROM node:20-slim

# pnpm via corepack (ships with node:20)
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Install deps first (leverage layer cache): copy manifests, install, then copy source
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY receipts/package.json ./receipts/
COPY agent/package.json ./agent/
COPY web/package.json ./web/
RUN pnpm install --frozen-lockfile

# Copy the rest and build
COPY . .
RUN pnpm run build

ENV NODE_ENV=production
ENV DRY_RUN=true
ENV PORT=10000
EXPOSE 10000

# The agent serves the built dashboard from web/dist on the same port.
WORKDIR /app/agent
CMD ["node", "dist/server.js"]
