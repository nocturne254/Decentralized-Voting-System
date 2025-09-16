/**
 * Production Logging and Monitoring System
 * Centralized logging with different levels and outputs
 */

const winston = require('winston');
const path = require('path');

// Custom log format
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return JSON.stringify({
            timestamp,
            level,
            message,
            ...meta
        });
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: {
        service: 'voting-system',
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    },
    transports: [
        // Console output for development
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        
        // File output for all logs
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/app.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 5,
            tailable: true
        }),
        
        // Separate file for errors
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/error.log'),
            level: 'error',
            maxsize: 10485760,
            maxFiles: 5,
            tailable: true
        })
    ],
    
    // Handle uncaught exceptions
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/exceptions.log')
        })
    ],
    
    // Handle unhandled promise rejections
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/rejections.log')
        })
    ]
});

// Add external logging services in production
if (process.env.NODE_ENV === 'production') {
    // Add Elasticsearch transport
    if (process.env.ELASTICSEARCH_URL) {
        const { ElasticsearchTransport } = require('winston-elasticsearch');
        
        logger.add(new ElasticsearchTransport({
            level: 'info',
            clientOpts: {
                node: process.env.ELASTICSEARCH_URL,
                auth: {
                    username: process.env.ELASTICSEARCH_USERNAME,
                    password: process.env.ELASTICSEARCH_PASSWORD
                }
            },
            index: 'voting-system-logs'
        }));
    }
    
    // Add Slack notifications for critical errors
    if (process.env.SLACK_WEBHOOK_URL) {
        const SlackHook = require('winston-slack-webhook-transport');
        
        logger.add(new SlackHook({
            webhookUrl: process.env.SLACK_WEBHOOK_URL,
            channel: '#alerts',
            username: 'VotingSystem',
            level: 'error',
            formatter: (info) => {
                return {
                    text: `🚨 Critical Error in Voting System`,
                    attachments: [{
                        color: 'danger',
                        fields: [{
                            title: 'Error Message',
                            value: info.message,
                            short: false
                        }, {
                            title: 'Environment',
                            value: info.environment,
                            short: true
                        }, {
                            title: 'Timestamp',
                            value: info.timestamp,
                            short: true
                        }]
                    }]
                };
            }
        }));
    }
}

// Custom logging methods for different contexts
class VotingLogger {
    static request(req, res, duration) {
        logger.info('HTTP Request', {
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            organizationId: req.headers['x-organization-id'],
            duration: `${duration}ms`,
            statusCode: res.statusCode
        });
    }
    
    static election(action, electionId, organizationId, metadata = {}) {
        logger.info('Election Action', {
            action,
            electionId,
            organizationId,
            ...metadata
        });
    }
    
    static vote(electionId, candidateId, organizationId, transactionHash) {
        logger.info('Vote Cast', {
            electionId,
            candidateId,
            organizationId,
            transactionHash,
            timestamp: new Date().toISOString()
        });
    }
    
    static blockchain(action, data) {
        logger.info('Blockchain Interaction', {
            action,
            ...data
        });
    }
    
    static security(event, details) {
        logger.warn('Security Event', {
            event,
            ...details,
            timestamp: new Date().toISOString()
        });
    }
    
    static performance(metric, value, context = {}) {
        logger.info('Performance Metric', {
            metric,
            value,
            ...context
        });
    }
    
    static error(error, context = {}) {
        logger.error('Application Error', {
            message: error.message,
            stack: error.stack,
            ...context
        });
    }
    
    static audit(action, userId, organizationId, details = {}) {
        logger.info('Audit Log', {
            action,
            userId,
            organizationId,
            ...details,
            timestamp: new Date().toISOString()
        });
    }
}

// Middleware for Express request logging
const requestLogger = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        VotingLogger.request(req, res, duration);
    });
    
    next();
};

// Health check logging
const healthCheck = () => {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    logger.info('Health Check', {
        memory: {
            rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
        },
        cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system
        },
        uptime: `${Math.round(process.uptime())}s`
    });
};

// Run health check every 5 minutes
if (process.env.NODE_ENV === 'production') {
    setInterval(healthCheck, 5 * 60 * 1000);
}

module.exports = {
    logger,
    VotingLogger,
    requestLogger,
    healthCheck
};
