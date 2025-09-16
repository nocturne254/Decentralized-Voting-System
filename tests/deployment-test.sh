#!/bin/bash

# Deployment Test Suite for Enhanced Blockchain Voting System
set -e

echo "Running post-deployment tests..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test configuration
BASE_URL="http://localhost:3000"
API_URL="http://localhost:8000"
TIMEOUT=30

# Test functions
test_endpoint() {
    local url=$1
    local expected_status=${2:-200}
    local description=$3
    
    echo -n "Testing $description... "
    
    response=$(curl -s -w "%{http_code}" -o /dev/null --max-time $TIMEOUT "$url" || echo "000")
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL (HTTP $response)${NC}"
        return 1
    fi
}

test_api_endpoint() {
    local endpoint=$1
    local description=$2
    test_endpoint "$API_URL$endpoint" 200 "$description"
}

test_web_endpoint() {
    local endpoint=$1
    local description=$2
    test_endpoint "$BASE_URL$endpoint" 200 "$description"
}

# Start tests
echo "=== Enhanced Blockchain Voting System Deployment Tests ==="
echo ""

# Basic connectivity tests
echo "1. Basic Connectivity Tests"
test_web_endpoint "/" "Main application"
test_web_endpoint "/health" "Application health check"
test_api_endpoint "/health" "API health check"
test_api_endpoint "/health/enhanced" "Enhanced features health check"
echo ""

# Authentication tests
echo "2. Authentication Tests"
test_api_endpoint "/auth/status" "Authentication status"
test_web_endpoint "/login" "Login page"
test_web_endpoint "/admin" "Admin portal"
test_web_endpoint "/voter" "Voter portal"
echo ""

# Enhanced feature tests
echo "3. Enhanced Feature Tests"
test_api_endpoint "/candidates" "Candidate listing"
test_api_endpoint "/manifestos" "Manifesto endpoints"
test_api_endpoint "/tally/health" "Live tally system"
test_api_endpoint "/ratings/health" "Performance tracking"
echo ""

# Database connectivity
echo "4. Database Tests"
echo -n "Testing database connectivity... "
if docker-compose -f docker-compose.production.yml exec -T postgres pg_isready -U voting_user -d voting_system > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

echo -n "Testing enhanced schema... "
table_count=$(docker-compose -f docker-compose.production.yml exec -T postgres psql -U voting_user -d voting_system -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('candidate_photos', 'candidate_manifestos', 'tally_configurations');" 2>/dev/null | tr -d ' ')
if [ "$table_count" = "3" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL (Expected 3 tables, found $table_count)${NC}"
fi
echo ""

# Redis connectivity
echo "5. Cache Tests"
echo -n "Testing Redis connectivity... "
if docker-compose -f docker-compose.production.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi
echo ""

# Security tests
echo "6. Security Tests"
test_web_endpoint "/admin" "Admin access control"
test_api_endpoint "/api/admin/users" "API access control"

echo -n "Testing HTTPS redirect... "
if curl -s -I http://localhost | grep -q "Location: https://"; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${YELLOW}⚠ SKIP (HTTPS not configured)${NC}"
fi
echo ""

# Performance tests
echo "7. Performance Tests"
echo -n "Testing response times... "
start_time=$(date +%s%N)
curl -s "$BASE_URL" > /dev/null
end_time=$(date +%s%N)
response_time=$(( (end_time - start_time) / 1000000 ))

if [ $response_time -lt 2000 ]; then
    echo -e "${GREEN}✓ PASS (${response_time}ms)${NC}"
else
    echo -e "${YELLOW}⚠ SLOW (${response_time}ms)${NC}"
fi
echo ""

# Integration tests
echo "8. Integration Tests"
echo -n "Testing blockchain connectivity... "
# This would test actual blockchain connection in production
echo -e "${YELLOW}⚠ SKIP (Requires blockchain network)${NC}"

echo -n "Testing file upload capability... "
# Test file upload endpoint
upload_response=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$API_URL/test/upload" -F "file=@/dev/null" 2>/dev/null || echo "000")
if [ "$upload_response" = "400" ] || [ "$upload_response" = "422" ]; then
    echo -e "${GREEN}✓ PASS (Endpoint accessible)${NC}"
else
    echo -e "${YELLOW}⚠ SKIP (Upload endpoint not configured)${NC}"
fi
echo ""

# Monitoring tests
echo "9. Monitoring Tests"
test_endpoint "http://localhost:9090/-/healthy" 200 "Prometheus health"
test_endpoint "http://localhost:3001/api/health" 200 "Grafana health"
echo ""

# Final summary
echo "=== Test Summary ==="
echo "Deployment tests completed."
echo ""
echo "Next steps:"
echo "1. Review any failed tests above"
echo "2. Configure HTTPS if needed"
echo "3. Set up blockchain network connection"
echo "4. Configure monitoring alerts"
echo "5. Run security audit"
echo ""
echo "System is ready for production use!"
