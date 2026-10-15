# Admin Frontend Dockerfile (React + Vite)
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app/admin

COPY admin/package*.json ./
RUN npm ci

# Builder stage
FROM base AS builder
WORKDIR /app/admin

COPY --from=deps /app/admin/node_modules ./node_modules
COPY admin/ .
COPY contracts/ /app/contracts/
COPY scripts/contracts/generate-response-types.mjs /app/scripts/contracts/generate-response-types.mjs
# Public build-time values (embedded into the bundle by Vite).
ENV VITE_API_BASE_URL=https://api.posbuzz.cloud/api/v1
ENV VITE_Root_Admin=superadmin@posbuzz.cloud

# Build the application
RUN npm run typecheck && npm run build

# Production stage - serve with nginx
FROM nginx:alpine AS runner

COPY --from=builder /app/admin/dist /usr/share/nginx/html

# nginx config for SPA (cache headers live in nginx.conf)
COPY admin/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
