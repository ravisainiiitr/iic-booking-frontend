#!/bin/sh
set -e

# Runtime configuration script for Vite app
# This script injects environment variables into the built app at runtime

# Default API URL if not set (production API)
API_URL="${VITE_API_URL:-http://15.206.88.2:8080/api}"

# Create a config.js file that can be loaded at runtime
# This allows changing the API URL without rebuilding the Docker image
cat > /usr/share/nginx/html/config.js <<EOF
window.__RUNTIME_CONFIG__ = {
  VITE_API_URL: '${API_URL}'
};
EOF

# Inject config.js into index.html before other scripts
# This ensures the config is available before the app loads
if ! grep -q "config.js" /usr/share/nginx/html/index.html; then
  sed -i 's|<head>|<head><script src="/config.js"></script>|' /usr/share/nginx/html/index.html
fi

# Execute the main command (nginx)
exec "$@"
