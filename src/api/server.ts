// Production-ready Express server for the Voting API
// Supports multi-tenant organizations with configurable settings

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { config } from 'dotenv';
import votingRoutes from './routes/voting.ts';
import { institutionConfig } from '../config/institution.ts';
import { logger } from '../js/utils/logger.ts';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_VERSION = 'v1';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration for multi-tenant support
const corsOptions = {
  origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // Get allowed origins from environment or use defaults
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://voting.mut.ac.ke',
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Organization-ID'],
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing and compression
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('API Request', 'SERVER', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      organizationId: req.headers['x-organization-id'],
    });
  });
  
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      institution: institutionConfig.getInstitutionName(),
      uptime: process.uptime(),
    }
  });
});

// API routes
app.use(`/api/${API_VERSION}`, votingRoutes);

// Serve static files for embeddable widgets
app.use('/embed', express.static('dist/embed'));
app.use('/assets', express.static('dist/assets'));

// Widget endpoint for iframe embedding
app.get('/embed/voting-widget', (req, res) => {
  const { organizationId, theme = 'light' } = req.query;
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Voting Widget - ${institutionConfig.getInstitutionName()}</title>
      <style>
        :root {
          --primary-color: ${institutionConfig.getPrimaryColor()};
          --secondary-color: ${institutionConfig.getConfig().secondaryColor};
          --accent-color: ${institutionConfig.getConfig().accentColor};
        }
        
        body {
          margin: 0;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: ${theme === 'dark' ? '#1a1a1a' : '#ffffff'};
          color: ${theme === 'dark' ? '#ffffff' : '#333333'};
        }
        
        .voting-widget {
          max-width: 600px;
          margin: 0 auto;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        .widget-header {
          background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
          color: white;
          padding: 20px;
          text-align: center;
        }
        
        .widget-content {
          padding: 20px;
        }
        
        .loading {
          text-align: center;
          padding: 40px;
        }
        
        .spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid var(--primary-color);
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="voting-widget">
        <div class="widget-header">
          <h2>${institutionConfig.getInstitutionName()}</h2>
          <p>Secure Blockchain Voting</p>
        </div>
        <div class="widget-content">
          <div class="loading">
            <div class="spinner"></div>
            <p>Loading voting interface...</p>
          </div>
        </div>
      </div>
      
      <script>
        // Initialize voting widget
        window.VotingWidget = {
          organizationId: '${organizationId}',
          theme: '${theme}',
          apiUrl: '${req.protocol}://${req.get('host')}/api/${API_VERSION}',
          
          init: function() {
            this.loadElections();
          },
          
          loadElections: function() {
            // This would connect to the API to load elections
            // For now, show a placeholder
            setTimeout(() => {
              document.querySelector('.widget-content').innerHTML = \`
                <div style="text-align: center; padding: 20px;">
                  <h3>No Active Elections</h3>
                  <p>There are currently no active elections for this organization.</p>
                  <p style="font-size: 0.9em; color: #666;">
                    Elections will appear here when they become available.
                  </p>
                </div>
              \`;
            }, 2000);
          }
        };
        
        // Auto-initialize when page loads
        document.addEventListener('DOMContentLoaded', function() {
          window.VotingWidget.init();
        });
      </script>
    </body>
    </html>
  `);
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled API Error', 'SERVER', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
  });
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { details: error.message }),
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully', 'SERVER');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully', 'SERVER');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info(`Voting API Server started`, 'SERVER', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    institution: institutionConfig.getInstitutionName(),
    version: '2.0.0',
  });
});

export default app;
