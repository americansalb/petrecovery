# PetRecovery.org Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Dependencies
# Debian (glibc), not Alpine: prerender on musl produced 'Element type
# is invalid: got undefined' for every page while the identical build
# passes on glibc. Match the environment the build is verified on.
FROM node:22-slim AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Full install: the builder stage needs dev tooling (tailwind, prisma
# CLI) to compile. The runner stage copies only the standalone output,
# so image size does not pay for this.
RUN npm ci

# Stage 2: Builder
FROM node:22-slim AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Set environment for build. The dummy DATABASE_URL and NEXTAUTH_SECRET
# exist only so `next build` can collect page data; they live in this
# builder stage only and never reach the runtime image, where the real
# values arrive from the platform environment.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build_dummy"
ENV NEXTAUTH_SECRET="build-dummy-secret-not-for-production"

# Build the application
RUN npm run build

# Stage 3: Runner
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Set correct permissions for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check (node-native: slim ships no wget)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 

# Start the application
CMD ["node", "server.js"]
