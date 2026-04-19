# -----------------------------------------------------------------------
# Multi-stage Dockerfile for SMS-API
# -----------------------------------------------------------------------

# Stage 1 – install production dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2 – final runtime image
FROM node:20-alpine AS runtime
WORKDIR /app

# Create a non-root user for security
RUN addgroup -S smsapi && adduser -S smsapi -G smsapi

# Copy application source and production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY public ./public

# Ensure the data directory exists and is writable by the app user
RUN mkdir -p /app/data && chown -R smsapi:smsapi /app

USER smsapi

EXPOSE 3000

ENV NODE_ENV=production

# Persist the SQLite database in a named volume
VOLUME ["/app/data"]

CMD ["node", "src/server.js"]
