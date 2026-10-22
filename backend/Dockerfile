# ==============================================================================
# Production Dockerfile for NestJS Backend with DuckDB OLAP Engine
# ==============================================================================

FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install native dependencies required for compiling duckdb native addons
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Stage 2: Runtime image
FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

# Create storage directories for raw files and parquet caches
RUN mkdir -p /app/storage/raw /app/storage/parquet_cache

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "dist/main.js"]
