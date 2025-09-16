#!/bin/bash

# Production Deployment Script for Multi-Tenant Voting System
# This script handles deployment to various environments

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="production"
SKIP_BUILD=false
SKIP_TESTS=false
BACKUP_DB=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -e|--environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --no-backup)
      BACKUP_DB=false
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -e, --environment ENV    Target environment (production, staging, development)"
      echo "  --skip-build            Skip the build process"
      echo "  --skip-tests            Skip running tests"
      echo "  --no-backup             Skip database backup"
      echo "  -h, --help              Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}🚀 Starting deployment to ${ENVIRONMENT} environment${NC}"

# Check if required files exist
if [ ! -f ".env.${ENVIRONMENT}" ]; then
    echo -e "${RED}❌ Environment file .env.${ENVIRONMENT} not found${NC}"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found${NC}"
    exit 1
fi

# Load environment variables
echo -e "${YELLOW}📋 Loading environment configuration...${NC}"
export $(cat .env.${ENVIRONMENT} | grep -v '^#' | xargs)

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm ci --only=production

# Run tests (unless skipped)
if [ "$SKIP_TESTS" = false ]; then
    echo -e "${YELLOW}🧪 Running tests...${NC}"
    npm run test:ci || {
        echo -e "${RED}❌ Tests failed. Deployment aborted.${NC}"
        exit 1
    }
    echo -e "${GREEN}✅ All tests passed${NC}"
fi

# Build the application (unless skipped)
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${YELLOW}🔨 Building application...${NC}"
    npm run build || {
        echo -e "${RED}❌ Build failed. Deployment aborted.${NC}"
        exit 1
    }
    echo -e "${GREEN}✅ Build completed successfully${NC}"
fi

# Database backup (if enabled)
if [ "$BACKUP_DB" = true ] && [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${YELLOW}💾 Creating database backup...${NC}"
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    
    if [ ! -z "$DATABASE_URL" ]; then
        pg_dump "$DATABASE_URL" > "backups/$BACKUP_FILE" || {
            echo -e "${YELLOW}⚠️  Database backup failed, continuing deployment...${NC}"
        }
        echo -e "${GREEN}✅ Database backup created: $BACKUP_FILE${NC}"
    else
        echo -e "${YELLOW}⚠️  DATABASE_URL not set, skipping backup${NC}"
    fi
fi

# Deploy based on environment
case $ENVIRONMENT in
    "production")
        deploy_production
        ;;
    "staging")
        deploy_staging
        ;;
    "development")
        deploy_development
        ;;
    *)
        echo -e "${RED}❌ Unknown environment: $ENVIRONMENT${NC}"
        exit 1
        ;;
esac

deploy_production() {
    echo -e "${YELLOW}🌐 Deploying to production...${NC}"
    
    # Create deployment directory
    DEPLOY_DIR="/var/www/voting-system"
    sudo mkdir -p "$DEPLOY_DIR"
    
    # Copy built files
    sudo cp -r dist/* "$DEPLOY_DIR/"
    sudo cp -r src/api "$DEPLOY_DIR/"
    sudo cp package.json "$DEPLOY_DIR/"
    sudo cp .env.production "$DEPLOY_DIR/.env"
    
    # Set permissions
    sudo chown -R www-data:www-data "$DEPLOY_DIR"
    sudo chmod -R 755 "$DEPLOY_DIR"
    
    # Install production dependencies
    cd "$DEPLOY_DIR"
    sudo -u www-data npm ci --only=production
    
    # Restart services
    sudo systemctl restart voting-api
    sudo systemctl restart nginx
    
    # Health check
    sleep 5
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Production deployment successful${NC}"
    else
        echo -e "${RED}❌ Health check failed${NC}"
        exit 1
    fi
}

deploy_staging() {
    echo -e "${YELLOW}🧪 Deploying to staging...${NC}"
    
    # Deploy to staging server
    rsync -avz --delete \
        --exclude=node_modules \
        --exclude=.git \
        ./ staging-server:/var/www/voting-system-staging/
    
    # Run deployment commands on staging server
    ssh staging-server << 'EOF'
        cd /var/www/voting-system-staging
        npm ci
        npm run build
        pm2 restart voting-api-staging
EOF
    
    echo -e "${GREEN}✅ Staging deployment successful${NC}"
}

deploy_development() {
    echo -e "${YELLOW}💻 Setting up development environment...${NC}"
    
    # Start development servers
    npm run dev &
    DEV_PID=$!
    
    # Start API server
    npm run api:dev &
    API_PID=$!
    
    echo -e "${GREEN}✅ Development servers started${NC}"
    echo -e "${BLUE}Frontend: http://localhost:5173${NC}"
    echo -e "${BLUE}API: http://localhost:3000${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop servers${NC}"
    
    # Wait for interrupt
    trap "kill $DEV_PID $API_PID 2>/dev/null" EXIT
    wait
}

# Docker deployment function
deploy_docker() {
    echo -e "${YELLOW}🐳 Deploying with Docker...${NC}"
    
    # Build Docker image
    docker build -t voting-system:${ENVIRONMENT} .
    
    # Stop existing container
    docker stop voting-system-${ENVIRONMENT} 2>/dev/null || true
    docker rm voting-system-${ENVIRONMENT} 2>/dev/null || true
    
    # Run new container
    docker run -d \
        --name voting-system-${ENVIRONMENT} \
        --env-file .env.${ENVIRONMENT} \
        -p 3000:3000 \
        -p 5173:5173 \
        voting-system:${ENVIRONMENT}
    
    echo -e "${GREEN}✅ Docker deployment successful${NC}"
}

# Kubernetes deployment function
deploy_kubernetes() {
    echo -e "${YELLOW}☸️  Deploying to Kubernetes...${NC}"
    
    # Apply Kubernetes manifests
    kubectl apply -f k8s/namespace.yaml
    kubectl apply -f k8s/configmap.yaml
    kubectl apply -f k8s/secret.yaml
    kubectl apply -f k8s/deployment.yaml
    kubectl apply -f k8s/service.yaml
    kubectl apply -f k8s/ingress.yaml
    
    # Wait for deployment to be ready
    kubectl rollout status deployment/voting-system -n voting-system
    
    echo -e "${GREEN}✅ Kubernetes deployment successful${NC}"
}

# Cleanup function
cleanup() {
    echo -e "${YELLOW}🧹 Cleaning up temporary files...${NC}"
    rm -rf temp_deploy/
}

# Set up cleanup trap
trap cleanup EXIT

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"

# Display post-deployment information
echo -e "\n${BLUE}📋 Post-deployment Information:${NC}"
echo -e "Environment: ${ENVIRONMENT}"
echo -e "Institution: ${VITE_INSTITUTION_NAME:-'Not configured'}"
echo -e "API URL: ${API_BASE_URL:-'http://localhost:3000'}"

if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "\n${YELLOW}🔧 Next Steps:${NC}"
    echo -e "1. Update DNS records if needed"
    echo -e "2. Configure SSL certificates"
    echo -e "3. Set up monitoring and alerts"
    echo -e "4. Test all functionality"
    echo -e "5. Notify stakeholders"
fi
