# Local development Dockerfile for React/Vite app
FROM node:20-alpine

ARG APP_HOME=/app

WORKDIR ${APP_HOME}

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy application code
COPY . ${APP_HOME}

# Expose Vite dev server port
EXPOSE 8080

# Start Vite dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
