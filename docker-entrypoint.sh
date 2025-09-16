#!/bin/sh

# Start the backend server in the background
cd /app
npm start &

# Start nginx in the foreground
nginx -g "daemon off;"
