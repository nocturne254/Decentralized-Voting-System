// Blockchain Manager Tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BlockchainManager } from '../../js/modules/blockchain.js';

// Mock Web3 and dependencies
const mockWeb3 = {
  eth: {
    net: {
      getId: vi.fn().mockResolvedValue(1337)
    },
    getBlockNumber: vi.fn().mockResolvedValue(12345)
  },
  currentProvider: {}
};

const mockContract = {
  createElection: vi.fn(),
  vote: vi.fn(),
  getElection: vi.fn(),
  getCandidateCount: vi.fn(),
  getCandidate: vi.fn(),
  getElectionCount: vi.fn(),
  hasVoted: vi.fn(),
  isElectionActive: vi.fn()
};

const mockTruffleContract = vi.fn().mockReturnValue({
  setProvider: vi.fn(),
  deployed: vi.fn().mockResolvedValue(mockContract)
});

// Mock global objects
global.window = {
  ethereum: {},
  Web3: vi.fn().mockImplementation(() => mockWeb3)
} as any;

(global as any).TruffleContract = mockTruffleContract;
(global as any).ElectionFactoryArtifacts = {};

describe('BlockchainManager', () => {
  let blockchainManager: BlockchainManager;

  beforeEach(() => {
    vi.clearAllMocks();
    blockchainManager = new BlockchainManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully with Web3 provider', async () => {
      const result = await blockchainManager.init();
      
      expect(result).toBe(true);
      expect(mockWeb3.eth.net.getId).toHaveBeenCalled();
      expect(mockTruffleContract).toHaveBeenCalled();
    });

    it('should throw error when Web3 provider not found', async () => {
      global.window.ethereum = undefined;
      
      await expect(blockchainManager.init()).rejects.toThrow('Web3 provider not found');
    });

    it('should not reinitialize if already initialized', async () => {
      await blockchainManager.init();
      vi.clearAllMocks();
      
      const result = await blockchainManager.init();
      
      expect(result).toBe(true);
      expect(mockWeb3.eth.net.getId).not.toHaveBeenCalled();
    });
  });

  describe('Election Management', () => {
    beforeEach(async () => {
      await blockchainManager.init();
    });

    it('should create election successfully', async () => {
      const mockResult = {
        logs: [{ args: { electionId: { toNumber: () => 1 } } }],
        tx: '0x123'
      };
      
      mockContract.createElection.mockResolvedValue(mockResult);
      // addCandidate is not part of the main contract interface - removing this line
      
      // Mock wallet manager
      blockchainManager.getWalletManager = vi.fn().mockReturnValue({
        getAccount: () => '0xabc123'
      });

      const candidates = [
        { name: 'Alice', party: 'Party A' },
        { name: 'Bob', party: 'Party B' }
      ];

      const result = await blockchainManager.createElection(
        'Test Election',
        Date.now(),
        Date.now() + 86400000,
        candidates
      );

      expect(result.electionId).toBe(1);
      expect(result.transactionHash).toBe('0x123');
      expect(mockContract.createElection).toHaveBeenCalled();
      // Candidates are added during election creation, not separately
    });

    it('should throw error when wallet not connected', async () => {
      blockchainManager.getWalletManager = vi.fn().mockReturnValue({
        getAccount: () => null
      });

      await expect(
        blockchainManager.createElection('Test', Date.now(), Date.now() + 86400000, [])
      ).rejects.toThrow('Wallet not connected');
    });

    it('should cast vote successfully', async () => {
      const mockResult = {
        tx: '0x456',
        receipt: { blockNumber: 12346 }
      };
      
      mockContract.vote.mockResolvedValue(mockResult);
      
      blockchainManager.getWalletManager = vi.fn().mockReturnValue({
        getAccount: () => '0xabc123'
      });

      const result = await blockchainManager.castVote(1, 2);

      expect(result.transactionHash).toBe('0x456');
      expect(result.blockNumber).toBe(12346);
      expect(mockContract.vote).toHaveBeenCalledWith(1, 2, {
        from: '0xabc123',
        gas: 200000
      });
    });

    it('should get election details', async () => {
      const mockElection = [
        { toNumber: () => 1 }, // id
        'Test Election', // name
        { toNumber: () => Date.now() }, // startTime
        { toNumber: () => Date.now() + 86400000 }, // endTime
        { toNumber: () => 2 } // candidateCount
      ];

      const mockCandidate1 = [
        { toNumber: () => 1 }, // id
        'Alice', // name
        'Party A', // party
        { toNumber: () => 10 } // voteCount
      ];

      const mockCandidate2 = [
        { toNumber: () => 2 }, // id
        'Bob', // name
        'Party B', // party
        { toNumber: () => 8 } // voteCount
      ];

      mockContract.getElection.mockResolvedValue(mockElection);
      mockContract.getCandidateCount.mockResolvedValue(2);
      mockContract.getCandidate
        .mockResolvedValueOnce(mockCandidate1)
        .mockResolvedValueOnce(mockCandidate2);

      const result = await blockchainManager.getElection(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Test Election');
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates[0].name).toBe('Alice');
      expect(result.candidates[0].voteCount).toBe(10);
    });

    it('should check if user has voted', async () => {
      mockContract.hasVoted.mockResolvedValue(true);
      
      blockchainManager.getWalletManager = vi.fn().mockReturnValue({
        getAccount: () => '0xabc123'
      });

      const result = await blockchainManager.hasVoted(1);

      expect(result).toBe(true);
      expect(mockContract.hasVoted).toHaveBeenCalledWith(1, {
        from: '0xabc123'
      });
    });

    it('should return false when checking vote status without wallet', async () => {
      blockchainManager.getWalletManager = vi.fn().mockReturnValue({
        getAccount: () => null
      });

      const result = await blockchainManager.hasVoted(1);

      expect(result).toBe(false);
    });
  });

  describe('Network Information', () => {
    beforeEach(async () => {
      await blockchainManager.init();
    });

    it('should get network info successfully', async () => {
      const result = await blockchainManager.getNetworkInfo();

      expect(result.networkId).toBe(1337);
      expect(result.blockNumber).toBe(12345);
      expect(result.isConnected).toBe(true);
    });

    it('should handle network info errors gracefully', async () => {
      mockWeb3.eth.net.getId.mockRejectedValue(new Error('Network error'));

      const result = await blockchainManager.getNetworkInfo();

      expect(result.networkId).toBe(null);
      expect(result.blockNumber).toBe(null);
      expect(result.isConnected).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle contract loading errors', async () => {
      mockTruffleContract().deployed.mockRejectedValue(new Error('Contract not found'));

      await expect(blockchainManager.init()).rejects.toThrow();
    });

    it('should handle election creation errors', async () => {
      await blockchainManager.init();
      
      mockContract.createElection.mockRejectedValue(new Error('Transaction failed'));
      
      blockchainManager.getWalletManager = vi.fn().mockReturnValue({
        getAccount: () => '0xabc123'
      });

      await expect(
        blockchainManager.createElection('Test', Date.now(), Date.now() + 86400000, [])
      ).rejects.toThrow();
    });
  });
});
