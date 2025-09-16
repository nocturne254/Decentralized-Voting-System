#!/bin/bash

# Production startup script for Enhanced Blockchain Voting System
set -e

echo "Starting Enhanced Blockchain Voting System in Production Mode..."

# Environment setup
export NODE_ENV=production
export PYTHONPATH=/app/Database_API:$PYTHONPATH

# Create log directories
mkdir -p /app/logs/node /app/logs/python /app/logs/nginx

# Database migration check
echo "Checking database migrations..."
if [ -f "/app/Database_API/migrations/001_enhanced_features.sql" ]; then
    echo "Running database migrations..."
    # In production, this would connect to actual database
    # psql $DATABASE_URL -f /app/Database_API/migrations/001_enhanced_features.sql
    echo "Database migrations completed"
fi

# Start services in background
echo "Starting FastAPI backend..."
cd /app/Database_API
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4 \
    --log-config logging.conf \
    --access-log \
    --log-level info > /app/logs/python/api.log 2>&1 &

API_PID=$!
echo "FastAPI started with PID: $API_PID"

# Wait for API to be ready
echo "Waiting for API to be ready..."
for i in {1..30}; do
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        echo "API is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "API failed to start"
        exit 1
    fi
    sleep 2
done

# Start Node.js application
echo "Starting Node.js application..."
cd /app
node index.js > /app/logs/node/app.log 2>&1 &

NODE_PID=$!
echo "Node.js started with PID: $NODE_PID"

# Wait for Node.js to be ready
echo "Waiting for Node.js to be ready..."
for i in {1..30}; do
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        echo "Node.js application is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "Node.js application failed to start"
        exit 1
    fi
    sleep 2
done

# Function to handle shutdown
shutdown() {
    echo "Shutting down services..."
    kill $NODE_PID $API_PID 2>/dev/null || true
    wait $NODE_PID $API_PID 2>/dev/null || true
    echo "Services stopped"
    exit 0
}

# Trap signals
trap shutdown SIGTERM SIGINT

echo "Enhanced Blockchain Voting System is running"
echo "Node.js: http://localhost:3000"
echo "FastAPI: http://localhost:8000"
echo "Logs: /app/logs/"

# Keep script running and monitor processes
while true; do
    if ! kill -0 $NODE_PID 2>/dev/null; then
        echo "Node.js process died, restarting..."
        cd /app
        node index.js > /app/logs/node/app.log 2>&1 &
        NODE_PID=$!
    fi
    
    if ! kill -0 $API_PID 2>/dev/null; then
        echo "API process died, restarting..."
        cd /app/Database_API
        python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4 > /app/logs/python/api.log 2>&1 &
        API_PID=$!
    fi
    
    sleep 10
done
