// REST API Routes for Voting Operations
// Provides external API access for organizations to integrate voting

import express, { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { BlockchainManager } from '../../js/modules/blockchain.js';
import { AuthManager } from '../../js/modules/auth.js';
import { institutionConfig } from '../../config/institution.ts';
import { logger } from '../../js/utils/logger.ts';

const router = express.Router();

// Middleware for API key authentication
interface AuthenticatedRequest extends Request {
  organizationId?: string;
  apiKey?: string;
}

const authenticateApiKey = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  const organizationId = req.headers['x-organization-id'] as string;

  if (!apiKey || !organizationId) {
    return res.status(401).json({
      success: false,
      error: 'Missing API key or organization ID',
      code: 'MISSING_CREDENTIALS'
    });
  }

  // TODO: Implement proper API key validation with database
  // For now, we'll use a simple validation
  if (!isValidApiKey(apiKey, organizationId)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key or organization ID',
      code: 'INVALID_CREDENTIALS'
    });
  }

  req.organizationId = organizationId;
  req.apiKey = apiKey;
  next();
};

// Simple API key validation (replace with proper database lookup)
function isValidApiKey(apiKey: string, organizationId: string): boolean {
  // This should be replaced with actual database validation
  const validKeys = new Map([
    ['org_mut_2024', 'sk_mut_12345abcdef'],
    ['org_demo_2024', 'sk_demo_67890ghijkl'],
  ]);
  
  return validKeys.get(organizationId) === apiKey;
}

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array(),
      code: 'VALIDATION_ERROR'
    });
  }
  next();
};

// GET /api/v1/elections - List all elections
router.get('/elections', 
  authenticateApiKey,
  query('status').optional().isIn(['active', 'upcoming', 'ended']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status, limit = 10, offset = 0 } = req.query;
      
      // Initialize blockchain manager
      const blockchainManager = new BlockchainManager();
      await blockchainManager.init();
      
      const elections = await blockchainManager.getAllElections();
      
      // Filter by status if provided
      let filteredElections = elections;
      if (status) {
        const now = Math.floor(Date.now() / 1000);
        filteredElections = elections.filter(election => {
          if (status === 'active') {
            return election.startTime <= now && election.endTime > now;
          } else if (status === 'upcoming') {
            return election.startTime > now;
          } else if (status === 'ended') {
            return election.endTime <= now;
          }
          return true;
        });
      }
      
      // Apply pagination
      const paginatedElections = filteredElections.slice(
        Number(offset), 
        Number(offset) + Number(limit)
      );
      
      res.json({
        success: true,
        data: {
          elections: paginatedElections,
          total: filteredElections.length,
          limit: Number(limit),
          offset: Number(offset)
        }
      });
      
      logger.info('Elections retrieved via API', 'API', {
        organizationId: req.organizationId,
        count: paginatedElections.length,
        status
      });
      
    } catch (error) {
      logger.error('Failed to retrieve elections', 'API', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve elections',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// POST /api/v1/elections - Create new election
router.post('/elections',
  authenticateApiKey,
  body('name').isString().isLength({ min: 1, max: 200 }),
  body('description').optional().isString().isLength({ max: 1000 }),
  body('startTime').isISO8601(),
  body('endTime').isISO8601(),
  body('candidates').isArray({ min: 2, max: 20 }),
  body('candidates.*.name').isString().isLength({ min: 1, max: 100 }),
  body('candidates.*.description').optional().isString().isLength({ max: 500 }),
  body('candidates.*.imageUrl').optional().isURL(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, description, startTime, endTime, candidates } = req.body;
      
      // Validate time constraints
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      const now = Date.now();
      
      if (start <= now) {
        return res.status(400).json({
          success: false,
          error: 'Election start time must be in the future',
          code: 'INVALID_START_TIME'
        });
      }
      
      if (end <= start) {
        return res.status(400).json({
          success: false,
          error: 'Election end time must be after start time',
          code: 'INVALID_END_TIME'
        });
      }
      
      // Initialize blockchain manager
      const blockchainManager = new BlockchainManager();
      await blockchainManager.init();
      
      // Create election on blockchain
      const electionId = await blockchainManager.createElection(
        name,
        description || '',
        candidates,
        Math.floor(start / 1000),
        Math.floor(end / 1000)
      );
      
      res.status(201).json({
        success: true,
        data: {
          electionId,
          name,
          description,
          startTime,
          endTime,
          candidates,
          status: 'upcoming'
        }
      });
      
      logger.info('Election created via API', 'API', {
        organizationId: req.organizationId,
        electionId,
        name,
        candidateCount: candidates.length
      });
      
    } catch (error) {
      logger.error('Failed to create election', 'API', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to create election',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// GET /api/v1/elections/:id - Get specific election
router.get('/elections/:id',
  authenticateApiKey,
  param('id').isInt({ min: 0 }),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const electionId = parseInt(req.params.id);
      
      const blockchainManager = new BlockchainManager();
      await blockchainManager.init();
      
      const election = await blockchainManager.getElection(electionId);
      
      if (!election) {
        return res.status(404).json({
          success: false,
          error: 'Election not found',
          code: 'ELECTION_NOT_FOUND'
        });
      }
      
      res.json({
        success: true,
        data: election
      });
      
    } catch (error) {
      logger.error('Failed to retrieve election', 'API', { 
        error: error.message,
        electionId: req.params.id 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve election',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// POST /api/v1/elections/:id/vote - Cast vote
router.post('/elections/:id/vote',
  authenticateApiKey,
  param('id').isInt({ min: 0 }),
  body('candidateId').isInt({ min: 0 }),
  body('voterAddress').isEthereumAddress(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const electionId = parseInt(req.params.id);
      const { candidateId, voterAddress } = req.body;
      
      const blockchainManager = new BlockchainManager();
      await blockchainManager.init();
      
      // Check if election exists and is active
      const election = await blockchainManager.getElection(electionId);
      if (!election) {
        return res.status(404).json({
          success: false,
          error: 'Election not found',
          code: 'ELECTION_NOT_FOUND'
        });
      }
      
      const now = Math.floor(Date.now() / 1000);
      if (now < election.startTime || now > election.endTime) {
        return res.status(400).json({
          success: false,
          error: 'Election is not currently active',
          code: 'ELECTION_NOT_ACTIVE'
        });
      }
      
      // Check if voter has already voted
      const hasVoted = await blockchainManager.hasVoted(electionId, voterAddress);
      if (hasVoted) {
        return res.status(400).json({
          success: false,
          error: 'Voter has already cast a vote in this election',
          code: 'ALREADY_VOTED'
        });
      }
      
      // Cast the vote
      const txHash = await blockchainManager.vote(electionId, candidateId, voterAddress);
      
      res.json({
        success: true,
        data: {
          transactionHash: txHash,
          electionId,
          candidateId,
          voterAddress,
          timestamp: new Date().toISOString()
        }
      });
      
      logger.info('Vote cast via API', 'API', {
        organizationId: req.organizationId,
        electionId,
        candidateId,
        txHash
      });
      
    } catch (error) {
      logger.error('Failed to cast vote', 'API', { 
        error: error.message,
        electionId: req.params.id 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to cast vote',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// GET /api/v1/elections/:id/results - Get election results
router.get('/elections/:id/results',
  authenticateApiKey,
  param('id').isInt({ min: 0 }),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const electionId = parseInt(req.params.id);
      
      const blockchainManager = new BlockchainManager();
      await blockchainManager.init();
      
      const results = await blockchainManager.getElectionResults(electionId);
      
      if (!results) {
        return res.status(404).json({
          success: false,
          error: 'Election not found',
          code: 'ELECTION_NOT_FOUND'
        });
      }
      
      res.json({
        success: true,
        data: results
      });
      
    } catch (error) {
      logger.error('Failed to retrieve results', 'API', { 
        error: error.message,
        electionId: req.params.id 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve results',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// GET /api/v1/health - Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      institution: institutionConfig.getInstitutionName()
    }
  });
});

export default router;
