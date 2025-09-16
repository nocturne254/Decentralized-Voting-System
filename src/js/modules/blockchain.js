// Blockchain Interaction Module - Modernized with ES2022+ features
import { logger } from '../utils/logger.ts';
import { ErrorHandler } from '../utils/errorHandler.ts';

import { WalletManager } from './wallet.js';

export class BlockchainManager {
  // Private fields using ES2022 syntax
  #web3 = null;
  #contracts = new Map();
  #walletManager = null;
  #networkId = null;
  #isInitialized = false;

  constructor() {
    this.#walletManager = new WalletManager();
    logger.info('BlockchainManager initialized', 'BLOCKCHAIN');
  }

  // Initialize blockchain connection with comprehensive error handling
  async init() {
    const startTime = performance.now();
    
    try {
      if (this.#isInitialized) {
        logger.debug('Blockchain already initialized', 'BLOCKCHAIN');
        return true;
      }

      logger.info('Initializing blockchain connection', 'BLOCKCHAIN');

      // Initialize Web3 with timeout
      if (window.ethereum) {
        this.#web3 = new Web3(window.ethereum);
        
        // Get network ID
        this.#networkId = await ErrorHandler.withTimeout(
          this.#web3.eth.net.getId(),
          10000
        );
        
        logger.info('Web3 initialized', 'BLOCKCHAIN', { networkId: this.#networkId });
      } else {
        throw new Error('Web3 provider not found. Please install MetaMask.');
      }

      // Initialize wallet with retry logic
      await ErrorHandler.withRetry(
        () => this.#walletManager.init(),
        { maxRetries: 3, delay: 1000 }
      );

      // Load contracts
      await this.loadContracts();

      this.#isInitialized = true;
      const duration = performance.now() - startTime;
      
      logger.info('Blockchain initialization completed', 'BLOCKCHAIN', { 
        duration: `${duration.toFixed(2)}ms`,
        networkId: this.#networkId 
      });

      return true;
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('Blockchain initialization failed', 'BLOCKCHAIN', { 
        error: error.message,
        duration: `${duration.toFixed(2)}ms` 
      });
      
      throw new Error(`Blockchain initialization failed: ${error.message}`);
    }
  }

  // Load smart contracts with modern error handling
  async loadContracts() {
    try {
      logger.info('Loading smart contracts', 'BLOCKCHAIN');

      // Load ElectionFactory contract
      const ElectionFactory = TruffleContract(ElectionFactoryArtifacts);
      ElectionFactory.setProvider(this.#web3.currentProvider);
      
      const electionFactory = await ErrorHandler.withTimeout(
        ElectionFactory.deployed(),
        15000
      );
      
      this.#contracts.set('electionFactory', electionFactory);
      
      logger.info('Contracts loaded successfully', 'BLOCKCHAIN', {
        contractsLoaded: Array.from(this.#contracts.keys())
      });
    } catch (error) {
      logger.error('Failed to load contracts', 'BLOCKCHAIN', error);
      throw ErrorHandler.createError('CONTRACT_LOAD_FAILED', error.message);
    }
  }

  // Create new election
  async createElection(name, startTime, endTime, candidates) {
    try {
      const account = this.walletManager.getAccount();
      if (!account) {
        throw new Error('Wallet not connected');
      }

      // Create election
      const result = await this.contracts.electionFactory.createElection(
        name,
        startTime,
        endTime,
        { from: account, gas: 500000 }
      );

      const electionId = result.logs[0].args.electionId.toNumber();

      // Add candidates
      for (const candidate of candidates) {
        await this.contracts.electionFactory.addCandidate(
          electionId,
          candidate.name,
          candidate.party,
          { from: account, gas: 200000 }
        );
      }

      return {
        electionId,
        transactionHash: result.tx
      };
    } catch (error) {
      console.error('Failed to create election:', error);
      throw error;
    }
  }

  // Cast vote
  async castVote(electionId, candidateId) {
    try {
      const account = this.walletManager.getAccount();
      if (!account) {
        throw new Error('Wallet not connected');
      }

      const result = await this.contracts.electionFactory.vote(
        electionId,
        candidateId,
        { from: account, gas: 200000 }
      );

      return {
        transactionHash: result.tx,
        blockNumber: result.receipt.blockNumber
      };
    } catch (error) {
      console.error('Failed to cast vote:', error);
      throw error;
    }
  }

  // Get election details
  async getElection(electionId) {
    try {
      const election = await this.contracts.electionFactory.getElection(electionId);
      const candidateCount = await this.contracts.electionFactory.getCandidateCount(electionId);
      
      const candidates = [];
      for (let i = 1; i <= candidateCount; i++) {
        const candidate = await this.contracts.electionFactory.getCandidate(electionId, i);
        candidates.push({
          id: candidate[0].toNumber(),
          name: candidate[1],
          party: candidate[2],
          voteCount: candidate[3].toNumber()
        });
      }

      return {
        id: election[0].toNumber(),
        name: election[1],
        startTime: election[2].toNumber(),
        endTime: election[3].toNumber(),
        candidateCount: election[4].toNumber(),
        candidates
      };
    } catch (error) {
      console.error('Failed to get election:', error);
      throw error;
    }
  }

  // Get all elections
  async getAllElections() {
    try {
      const electionCount = await this.contracts.electionFactory.getElectionCount();
      const elections = [];

      for (let i = 1; i <= electionCount; i++) {
        try {
          const election = await this.getElection(i);
          elections.push(election);
        } catch (error) {
          console.warn(`Failed to load election ${i}:`, error);
        }
      }

      return elections;
    } catch (error) {
      console.error('Failed to get all elections:', error);
      throw error;
    }
  }

  // Check if user has voted
  async hasVoted(electionId) {
    try {
      const account = this.walletManager.getAccount();
      if (!account) {
        return false;
      }

      return await this.contracts.electionFactory.hasVoted(electionId, { from: account });
    } catch (error) {
      console.error('Failed to check vote status:', error);
      return false;
    }
  }

  // Check if election is active
  async isElectionActive(electionId) {
    try {
      return await this.contracts.electionFactory.isElectionActive(electionId);
    } catch (error) {
      console.error('Failed to check election status:', error);
      return false;
    }
  }

  // Get network info
  async getNetworkInfo() {
    try {
      const networkId = await this.web3.eth.net.getId();
      const blockNumber = await this.web3.eth.getBlockNumber();
      
      return {
        networkId,
        blockNumber,
        isConnected: true
      };
    } catch (error) {
      console.error('Failed to get network info:', error);
      return {
        networkId: null,
        blockNumber: null,
        isConnected: false
      };
    }
  }

  // Get wallet manager instance
  getWalletManager() {
    return this.walletManager;
  }
}
