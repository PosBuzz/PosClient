# Backend Dockerfile (NestJS)
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Builder stage
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production-only dependencies: the test/lint toolchain (Jest, ts-jest, eslint, ...)
# stays out of the runtime image. prisma is a real dependency because the
# container runs `prisma migrate deploy` on start.
FROM base AS prod-deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install PostgreSQL client tools for backup/restore
RUN apk add --no-cache postgresql-client

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy necessary files
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# Create directories for uploads and receipts
RUN mkdir -p uploads receipts temp && chown -R nestjs:nodejs uploads receipts temp

USER nestjs

EXPOSE 8000

CMD ["node", "dist/src/main"]
