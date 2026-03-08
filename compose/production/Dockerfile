# Production Dockerfile for React/Vite app
# Build stage
FROM node:20-alpine AS build

ARG APP_HOME=/app
ARG VITE_API_URL

WORKDIR ${APP_HOME}

# Copy package files
COPY package*.json ./

# Install dependencies (--legacy-peer-deps until lockfile aligns eslint with eslint-plugin-react-hooks peer)
RUN npm ci --legacy-peer-deps

# Copy application code
COPY . ${APP_HOME}

# Build the application
# Set VITE_API_URL as build-time argument if provided
RUN if [ -n "$VITE_API_URL" ]; then \
      VITE_API_URL=$VITE_API_URL npm run build; \
    else \
      npm run build; \
    fi

# Production stage with nginx
FROM nginx:alpine

# Install gettext for envsubst (for runtime env var substitution)
RUN apk add --no-cache gettext

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY compose/production/nginx.conf /etc/nginx/conf.d/default.conf

# Copy entrypoint script
COPY compose/production/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose port 80
EXPOSE 80

# Use entrypoint to inject runtime config
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
