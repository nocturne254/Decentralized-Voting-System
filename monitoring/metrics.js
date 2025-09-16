/**
 * Production Metrics and Monitoring System
 * Collects and exports application metrics for monitoring
 */

const promClient = require('prom-client');

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Add default metrics
promClient.collectDefaultMetrics({
    register,
    prefix: 'voting_system_'
});

// Custom metrics for voting system
const httpRequestDuration = new promClient.Histogram({
    name: 'voting_system_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code', 'organization_id'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestTotal = new promClient.Counter({
    name: 'voting_system_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code', 'organization_id']
});

const activeElections = new promClient.Gauge({
    name: 'voting_system_active_elections_total',
    help: 'Number of currently active elections',
    labelNames: ['organization_id']
});

const totalVotes = new promClient.Counter({
    name: 'voting_system_votes_total',
    help: 'Total number of votes cast',
    labelNames: ['election_id', 'organization_id']
});

const blockchainTransactions = new promClient.Counter({
    name: 'voting_system_blockchain_transactions_total',
    help: 'Total number of blockchain transactions',
    labelNames: ['type', 'status', 'organization_id']
});

const apiErrors = new promClient.Counter({
    name: 'voting_system_api_errors_total',
    help: 'Total number of API errors',
    labelNames: ['error_type', 'endpoint', 'organization_id']
});

const databaseConnections = new promClient.Gauge({
    name: 'voting_system_database_connections_active',
    help: 'Number of active database connections'
});

const widgetLoads = new promClient.Counter({
    name: 'voting_system_widget_loads_total',
    help: 'Total number of widget loads',
    labelNames: ['organization_id', 'theme']
});

const userSessions = new promClient.Gauge({
    name: 'voting_system_user_sessions_active',
    help: 'Number of active user sessions',
    labelNames: ['organization_id']
});

const electionDuration = new promClient.Histogram({
    name: 'voting_system_election_duration_hours',
    help: 'Duration of elections in hours',
    labelNames: ['organization_id'],
    buckets: [1, 6, 12, 24, 48, 72, 168] // 1h to 1 week
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(activeElections);
register.registerMetric(totalVotes);
register.registerMetric(blockchainTransactions);
register.registerMetric(apiErrors);
register.registerMetric(databaseConnections);
register.registerMetric(widgetLoads);
register.registerMetric(userSessions);
register.registerMetric(electionDuration);

// Metrics collection class
class MetricsCollector {
    static recordHttpRequest(method, route, statusCode, organizationId, duration) {
        const labels = { method, route, status_code: statusCode, organization_id: organizationId };
        
        httpRequestDuration.observe(labels, duration / 1000);
        httpRequestTotal.inc(labels);
    }
    
    static updateActiveElections(organizationId, count) {
        activeElections.set({ organization_id: organizationId }, count);
    }
    
    static recordVote(electionId, organizationId) {
        totalVotes.inc({ election_id: electionId, organization_id: organizationId });
    }
    
    static recordBlockchainTransaction(type, status, organizationId) {
        blockchainTransactions.inc({ type, status, organization_id: organizationId });
    }
    
    static recordApiError(errorType, endpoint, organizationId) {
        apiErrors.inc({ error_type: errorType, endpoint, organization_id: organizationId });
    }
    
    static updateDatabaseConnections(count) {
        databaseConnections.set(count);
    }
    
    static recordWidgetLoad(organizationId, theme) {
        widgetLoads.inc({ organization_id: organizationId, theme });
    }
    
    static updateUserSessions(organizationId, count) {
        userSessions.set({ organization_id: organizationId }, count);
    }
    
    static recordElectionDuration(organizationId, durationHours) {
        electionDuration.observe({ organization_id: organizationId }, durationHours);
    }
    
    // Business metrics
    static getVotingRate(electionId) {
        // Calculate votes per hour for an election
        const metric = register.getSingleMetric('voting_system_votes_total');
        if (metric) {
            const values = metric.get().values;
            const electionVotes = values.filter(v => v.labels.election_id === electionId);
            return electionVotes.reduce((sum, v) => sum + v.value, 0);
        }
        return 0;
    }
    
    static getSystemHealth() {
        const metrics = register.getMetricsAsJSON();
        const errorRate = this.calculateErrorRate(metrics);
        const avgResponseTime = this.calculateAvgResponseTime(metrics);
        
        return {
            status: errorRate < 0.05 && avgResponseTime < 1000 ? 'healthy' : 'degraded',
            errorRate,
            avgResponseTime,
            timestamp: new Date().toISOString()
        };
    }
    
    static calculateErrorRate(metrics) {
        const totalRequests = metrics.find(m => m.name === 'voting_system_http_requests_total');
        const errorRequests = metrics.find(m => m.name === 'voting_system_api_errors_total');
        
        if (!totalRequests || !errorRequests) return 0;
        
        const total = totalRequests.values.reduce((sum, v) => sum + v.value, 0);
        const errors = errorRequests.values.reduce((sum, v) => sum + v.value, 0);
        
        return total > 0 ? errors / total : 0;
    }
    
    static calculateAvgResponseTime(metrics) {
        const responseTime = metrics.find(m => m.name === 'voting_system_http_request_duration_seconds');
        
        if (!responseTime) return 0;
        
        const buckets = responseTime.values.filter(v => v.labels.le);
        if (buckets.length === 0) return 0;
        
        // Simple average calculation from histogram buckets
        let totalTime = 0;
        let totalCount = 0;
        
        buckets.forEach(bucket => {
            const time = parseFloat(bucket.labels.le);
            const count = bucket.value;
            totalTime += time * count;
            totalCount += count;
        });
        
        return totalCount > 0 ? (totalTime / totalCount) * 1000 : 0; // Convert to ms
    }
}

// Express middleware for automatic metrics collection
const metricsMiddleware = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const organizationId = req.headers['x-organization-id'] || 'unknown';
        const route = req.route ? req.route.path : req.path;
        
        MetricsCollector.recordHttpRequest(
            req.method,
            route,
            res.statusCode,
            organizationId,
            duration
        );
    });
    
    next();
};

// Metrics endpoint for Prometheus scraping
const metricsEndpoint = async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        const metrics = await register.metrics();
        res.end(metrics);
    } catch (error) {
        res.status(500).end(error.message);
    }
};

// Health check endpoint with metrics
const healthEndpoint = (req, res) => {
    const health = MetricsCollector.getSystemHealth();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
};

// Background metrics collection
const collectBackgroundMetrics = () => {
    // Update database connection count
    if (global.dbPool) {
        MetricsCollector.updateDatabaseConnections(global.dbPool.totalConnections || 0);
    }
    
    // Update active elections count (would need to query database)
    // This is a placeholder - implement based on your database structure
    // MetricsCollector.updateActiveElections('all', activeElectionCount);
};

// Run background collection every 30 seconds
if (process.env.NODE_ENV === 'production') {
    setInterval(collectBackgroundMetrics, 30000);
}

// Alert thresholds
const ALERT_THRESHOLDS = {
    ERROR_RATE: 0.05, // 5%
    RESPONSE_TIME: 2000, // 2 seconds
    MEMORY_USAGE: 0.8, // 80%
    CPU_USAGE: 0.8 // 80%
};

// Alert checker
const checkAlerts = () => {
    const health = MetricsCollector.getSystemHealth();
    const alerts = [];
    
    if (health.errorRate > ALERT_THRESHOLDS.ERROR_RATE) {
        alerts.push({
            type: 'HIGH_ERROR_RATE',
            value: health.errorRate,
            threshold: ALERT_THRESHOLDS.ERROR_RATE,
            severity: 'critical'
        });
    }
    
    if (health.avgResponseTime > ALERT_THRESHOLDS.RESPONSE_TIME) {
        alerts.push({
            type: 'HIGH_RESPONSE_TIME',
            value: health.avgResponseTime,
            threshold: ALERT_THRESHOLDS.RESPONSE_TIME,
            severity: 'warning'
        });
    }
    
    // Memory usage check
    const memUsage = process.memoryUsage();
    const memUsagePercent = memUsage.heapUsed / memUsage.heapTotal;
    
    if (memUsagePercent > ALERT_THRESHOLDS.MEMORY_USAGE) {
        alerts.push({
            type: 'HIGH_MEMORY_USAGE',
            value: memUsagePercent,
            threshold: ALERT_THRESHOLDS.MEMORY_USAGE,
            severity: 'warning'
        });
    }
    
    return alerts;
};

// Export alerts for external monitoring systems
const getAlerts = (req, res) => {
    const alerts = checkAlerts();
    res.json({
        alerts,
        timestamp: new Date().toISOString(),
        count: alerts.length
    });
};

module.exports = {
    register,
    MetricsCollector,
    metricsMiddleware,
    metricsEndpoint,
    healthEndpoint,
    getAlerts,
    checkAlerts,
    ALERT_THRESHOLDS
};
