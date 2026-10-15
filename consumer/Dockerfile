# Consumer Frontend Dockerfile (React + Vite + PWA)
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app/consumer

COPY consumer/package*.json ./
RUN npm ci

# Builder stage
FROM base AS builder
WORKDIR /app/consumer

COPY --from=deps /app/consumer/node_modules ./node_modules
COPY consumer/ .
COPY contracts/ /app/contracts/
COPY scripts/contracts/generate-response-types.mjs /app/scripts/contracts/generate-response-types.mjs
# Public build-time values (embedded into the bundle by Vite).
# Overridden per environment by the deploy workflows (staging vs production).
ARG VITE_API_BASE_URL=https://api.posbuzz.xyz/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_CLOUD_NAME=ddluuftiq
ENV VITE_UPLOAD_PRESET=test-preset
ENV VITE_CLOUDINARY_API=https://api.cloudinary.com/v1_1/ddluuftiq/image/upload

# Build the application
RUN npm run typecheck && npm run build

# Production stage - serve with nginx
FROM nginx:alpine AS runner

COPY --from=builder /app/consumer/dist /usr/share/nginx/html

# nginx config for PWA/SPA (cache headers live in nginx.conf)
COPY consumer/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
