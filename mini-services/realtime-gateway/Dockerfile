# ============================================================
# UCP Realtime Gateway - Dockerfile
# Deploy on Railway / Render / Fly.io / DigitalOcean App Platform
# ============================================================

# Use the official Bun image (smaller and faster than Node)
FROM oven/bun:1.1 AS base

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json bun.lock* ./

# Install dependencies (including pg for PostgreSQL support)
RUN bun install --frozen-lockfile

# Copy source code
COPY index.ts tsconfig.json ./

# Create a non-root user for security
RUN adduser --disabled-password --gecos "" --uid 1001 bunuser && \
    chown -R bunuser:bunuser /app
USER bunuser

# Expose the Gateway port (Railway/Render inject PORT env var automatically)
EXPOSE 3003

# Health check — Railway/Render will ping /health to verify
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:'+process.env.PORT||'3003'+'/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

# Run the Gateway
CMD ["bun", "index.ts"]
