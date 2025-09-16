#!/bin/bash

# Enhanced Production Deployment Script for Blockchain Voting System
set -e

echo "Starting Enhanced Blockchain Voting System Deployment..."

# Configuration
ENVIRONMENT=${1:-production}
COMPOSE_FILE="docker-compose.production.yml"
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Pre-deployment checks
log "Running pre-deployment checks..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    error "Docker is not running. Please start Docker and try again."
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    error "docker-compose is not installed. Please install it and try again."
fi

# Check environment file
if [ ! -f "docker/production.env" ]; then
    error "Production environment file not found. Please create docker/production.env"
fi

# Validate environment variables
log "Validating environment configuration..."
source docker/production.env

required_vars=(
    "DATABASE_URL"
    "JWT_SECRET"
    "ENCRYPTION_KEY"
    "BLOCKCHAIN_NETWORK"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        error "Required environment variable $var is not set"
    fi
done

# Create backup if system is already running
if docker-compose -f $COMPOSE_FILE ps | grep -q "Up"; then
    log "Creating backup before deployment..."
    mkdir -p $BACKUP_DIR
    
    # Backup database
    docker-compose -f $COMPOSE_FILE exec -T postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > $BACKUP_DIR/database.sql
    
    # Backup uploads
    if [ -d "./uploads" ]; then
        cp -r ./uploads $BACKUP_DIR/
    fi
    
    log "Backup created at $BACKUP_DIR"
fi

# Pull latest images
log "Pulling latest Docker images..."
docker-compose -f $COMPOSE_FILE pull

# Build application
log "Building application..."
docker-compose -f $COMPOSE_FILE build --no-cache

# Run database migrations
log "Running database migrations..."
docker-compose -f $COMPOSE_FILE up -d postgres redis
sleep 10

# Wait for database to be ready
log "Waiting for database to be ready..."
for i in {1..30}; do
    if docker-compose -f $COMPOSE_FILE exec -T postgres pg_isready -U $POSTGRES_USER -d $POSTGRES_DB > /dev/null 2>&1; then
        log "Database is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        error "Database failed to start"
    fi
    sleep 2
done

# Apply migrations
if [ -f "Database_API/migrations/001_enhanced_features.sql" ]; then
    log "Applying database migrations..."
    docker-compose -f $COMPOSE_FILE exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -f /docker-entrypoint-initdb.d/001_enhanced_features.sql
fi

# Start all services
log "Starting all services..."
docker-compose -f $COMPOSE_FILE up -d

# Wait for services to be ready
log "Waiting for services to be ready..."
sleep 30

# Health checks
log "Running health checks..."
services=("voting-app:3000" "voting-app:8000")
for service in "${services[@]}"; do
    host=$(echo $service | cut -d: -f1)
    port=$(echo $service | cut -d: -f2)
    
    for i in {1..30}; do
        if docker-compose -f $COMPOSE_FILE exec -T voting-app curl -f http://localhost:$port/health > /dev/null 2>&1; then
            log "$host:$port is healthy"
            break
        fi
        if [ $i -eq 30 ]; then
            warn "$host:$port health check failed"
        fi
        sleep 2
    done
done

# Run post-deployment tests
log "Running post-deployment tests..."
if [ -f "tests/deployment-test.sh" ]; then
    bash tests/deployment-test.sh
else
    warn "No deployment tests found"
fi

# Display deployment information
log "Deployment completed successfully!"
echo ""
echo "=== Deployment Information ==="
echo "Environment: $ENVIRONMENT"
echo "Services:"
echo "  - Main Application: http://localhost:3000"
echo "  - API: http://localhost:8000"
echo "  - Grafana Dashboard: http://localhost:3001"
echo "  - Prometheus: http://localhost:9090"
echo ""
echo "=== Service Status ==="
docker-compose -f $COMPOSE_FILE ps
echo ""

# Show logs for any failed services
failed_services=$(docker-compose -f $COMPOSE_FILE ps --services --filter "status=exited")
if [ ! -z "$failed_services" ]; then
    warn "Some services failed to start:"
    for service in $failed_services; do
        echo "=== Logs for $service ==="
        docker-compose -f $COMPOSE_FILE logs --tail=50 $service
    done
fi

log "Deployment script completed!"
echo ""
echo "Next steps:"
echo "1. Configure SSL certificates if using HTTPS"
echo "2. Set up monitoring alerts"
echo "3. Configure backup schedules"
echo "4. Run security audit"
echo ""
echo "To view logs: docker-compose -f $COMPOSE_FILE logs -f"
echo "To stop services: docker-compose -f $COMPOSE_FILE down"
