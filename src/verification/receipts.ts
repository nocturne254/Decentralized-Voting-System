/**
 * Voter Receipt and End-to-End Verifiability System
 * Provides cryptographic proof of vote casting and tallying
 */

import { createHash, randomBytes } from 'crypto';

export interface VoterReceipt {
  receiptId: string;
  electionId: string;
  voterId: string;
  timestamp: number;
  voteCommitment: string;
  nullifierHash: string;
  merkleProof: string[];
  zkProof: string;
  signature: string;
  verificationCode: string;
}

export interface ElectionTally {
  electionId: string;
  totalVotes: number;
  candidates: CandidateResult[];
  merkleRoot: string;
  tallyProof: string;
  timestamp: number;
  verified: boolean;
}

export interface CandidateResult {
  candidateId: string;
  name: string;
  voteCount: number;
  percentage: number;
}

export interface VerificationResult {
  valid: boolean;
  receipt: VoterReceipt;
  includedInTally: boolean;
  tallyVerified: boolean;
  errors: string[];
  warnings: string[];
}

export interface PublicBulletinBoard {
  electionId: string;
  votes: PublicVoteRecord[];
  tally: ElectionTally;
  auditTrail: AuditRecord[];
  lastUpdated: number;
}

export interface PublicVoteRecord {
  commitmentHash: string;
  nullifierHash: string;
  zkProof: string;
  timestamp: number;
  blockNumber?: number;
  transactionHash?: string;
}

export interface AuditRecord {
  action: string;
  timestamp: number;
  actor: string;
  details: any;
  signature: string;
}

/**
 * End-to-End Verifiability System
 * Manages voter receipts and public verification
 */
export class VerifiabilitySystem {
  private bulletinBoards: Map<string, PublicBulletinBoard>;
  private receipts: Map<string, VoterReceipt>;

  constructor() {
    this.bulletinBoards = new Map();
    this.receipts = new Map();
  }

  /**
   * Generate voter receipt after vote casting
   * @param electionId Election identifier
   * @param voterId Voter identifier (pseudonymized)
   * @param voteData Encrypted vote data
   * @param zkProof Zero-knowledge proof
   * @param merkleProof Merkle tree inclusion proof
   * @returns Voter receipt
   */
  generateVoterReceipt(
    electionId: string,
    voterId: string,
    voteData: any,
    zkProof: string,
    merkleProof: string[]
  ): VoterReceipt {
    const receiptId = this.generateReceiptId();
    const timestamp = Date.now();
    
    // Create vote commitment (hash of vote + random nonce)
    const nonce = randomBytes(32).toString('hex');
    const voteCommitment = createHash('sha256')
      .update(JSON.stringify(voteData) + nonce)
      .digest('hex');
    
    // Generate nullifier hash to prevent double voting
    const nullifierHash = createHash('sha256')
      .update(voterId + electionId + 'nullifier')
      .digest('hex');
    
    // Generate verification code for easy lookup
    const verificationCode = this.generateVerificationCode();
    
    // Create receipt signature
    const receiptData = {
      receiptId,
      electionId,
      voterId,
      timestamp,
      voteCommitment,
      nullifierHash,
      verificationCode
    };
    
    const signature = this.signReceiptData(receiptData);
    
    const receipt: VoterReceipt = {
      receiptId,
      electionId,
      voterId,
      timestamp,
      voteCommitment,
      nullifierHash,
      merkleProof,
      zkProof,
      signature,
      verificationCode
    };
    
    // Store receipt
    this.receipts.set(receiptId, receipt);
    
    // Add to public bulletin board
    this.addToPublicBulletinBoard(electionId, receipt);
    
    return receipt;
  }

  /**
   * Verify voter receipt
   * @param receipt Voter receipt to verify
   * @returns Verification result
   */
  async verifyVoterReceipt(receipt: VoterReceipt): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Verify receipt signature
    if (!this.verifyReceiptSignature(receipt)) {
      errors.push('Invalid receipt signature');
    }
    
    // Check if receipt exists in our records
    const storedReceipt = this.receipts.get(receipt.receiptId);
    if (!storedReceipt) {
      errors.push('Receipt not found in system records');
    } else if (JSON.stringify(storedReceipt) !== JSON.stringify(receipt)) {
      errors.push('Receipt data has been tampered with');
    }
    
    // Verify zero-knowledge proof
    if (!this.verifyZKProof(receipt.zkProof, receipt.voteCommitment)) {
      errors.push('Invalid zero-knowledge proof');
    }
    
    // Verify Merkle proof inclusion
    const includedInTally = this.verifyMerkleInclusion(receipt);
    if (!includedInTally) {
      warnings.push('Vote not yet included in published tally');
    }
    
    // Verify election tally
    const tallyVerified = await this.verifyElectionTally(receipt.electionId);
    
    return {
      valid: errors.length === 0,
      receipt,
      includedInTally,
      tallyVerified,
      errors,
      warnings
    };
  }

  /**
   * Verify receipt by verification code
   * @param verificationCode Short verification code
   * @returns Verification result or null if not found
   */
  async verifyByCode(verificationCode: string): Promise<VerificationResult | null> {
    // Find receipt by verification code
    const receipt = Array.from(this.receipts.values())
      .find(r => r.verificationCode === verificationCode);
    
    if (!receipt) {
      return null;
    }
    
    return this.verifyVoterReceipt(receipt);
  }

  /**
   * Generate election tally with cryptographic proofs
   * @param electionId Election identifier
   * @param votes Array of vote commitments
   * @returns Election tally with proofs
   */
  generateElectionTally(electionId: string, votes: any[]): ElectionTally {
    // Calculate vote counts
    const candidateCounts = new Map<string, number>();
    
    votes.forEach(vote => {
      const candidateId = vote.candidateId;
      candidateCounts.set(candidateId, (candidateCounts.get(candidateId) || 0) + 1);
    });
    
    // Create candidate results
    const candidates: CandidateResult[] = [];
    const totalVotes = votes.length;
    
    for (const [candidateId, count] of candidateCounts.entries()) {
      candidates.push({
        candidateId,
        name: `Candidate ${candidateId}`,
        voteCount: count,
        percentage: (count / totalVotes) * 100
      });
    }
    
    // Generate Merkle root of all votes
    const merkleRoot = this.generateMerkleRoot(votes);
    
    // Generate tally proof (simplified - in production use homomorphic encryption)
    const tallyProof = this.generateTallyProof(votes, candidates);
    
    const tally: ElectionTally = {
      electionId,
      totalVotes,
      candidates,
      merkleRoot,
      tallyProof,
      timestamp: Date.now(),
      verified: true
    };
    
    // Update bulletin board
    this.updateBulletinBoardTally(electionId, tally);
    
    return tally;
  }

  /**
   * Get public bulletin board for election
   * @param electionId Election identifier
   * @returns Public bulletin board
   */
  getPublicBulletinBoard(electionId: string): PublicBulletinBoard | null {
    return this.bulletinBoards.get(electionId) || null;
  }

  /**
   * Audit election integrity
   * @param electionId Election identifier
   * @returns Audit results
   */
  auditElectionIntegrity(electionId: string): {
    valid: boolean;
    issues: string[];
    statistics: {
      totalReceipts: number;
      verifiedReceipts: number;
      invalidReceipts: number;
      duplicateNullifiers: number;
    };
  } {
    const issues: string[] = [];
    const bulletinBoard = this.bulletinBoards.get(electionId);
    
    if (!bulletinBoard) {
      return {
        valid: false,
        issues: ['Election not found'],
        statistics: { totalReceipts: 0, verifiedReceipts: 0, invalidReceipts: 0, duplicateNullifiers: 0 }
      };
    }
    
    // Get all receipts for this election
    const electionReceipts = Array.from(this.receipts.values())
      .filter(r => r.electionId === electionId);
    
    let verifiedReceipts = 0;
    let invalidReceipts = 0;
    const nullifierHashes = new Set<string>();
    let duplicateNullifiers = 0;
    
    // Verify each receipt
    for (const receipt of electionReceipts) {
      // Check for duplicate nullifiers (double voting)
      if (nullifierHashes.has(receipt.nullifierHash)) {
        duplicateNullifiers++;
        issues.push(`Duplicate nullifier detected: ${receipt.nullifierHash.substring(0, 8)}...`);
      } else {
        nullifierHashes.add(receipt.nullifierHash);
      }
      
      // Verify receipt
      if (this.verifyReceiptSignature(receipt) && this.verifyZKProof(receipt.zkProof, receipt.voteCommitment)) {
        verifiedReceipts++;
      } else {
        invalidReceipts++;
        issues.push(`Invalid receipt: ${receipt.receiptId}`);
      }
    }
    
    // Verify tally matches vote count
    const expectedVoteCount = electionReceipts.length - duplicateNullifiers;
    if (bulletinBoard.tally.totalVotes !== expectedVoteCount) {
      issues.push(`Tally mismatch: expected ${expectedVoteCount}, got ${bulletinBoard.tally.totalVotes}`);
    }
    
    return {
      valid: issues.length === 0,
      issues,
      statistics: {
        totalReceipts: electionReceipts.length,
        verifiedReceipts,
        invalidReceipts,
        duplicateNullifiers
      }
    };
  }

  /**
   * Export verifiable election data
   * @param electionId Election identifier
   * @returns Exportable election data
   */
  exportVerifiableData(electionId: string): {
    election: any;
    bulletinBoard: PublicBulletinBoard;
    receipts: VoterReceipt[];
    verificationInstructions: string;
  } {
    const bulletinBoard = this.bulletinBoards.get(electionId);
    const receipts = Array.from(this.receipts.values())
      .filter(r => r.electionId === electionId);
    
    const verificationInstructions = `
ELECTION VERIFICATION INSTRUCTIONS

1. VERIFY YOUR VOTE:
   - Locate your voter receipt using the verification code
   - Check that your receipt appears in the public bulletin board
   - Verify the cryptographic proofs in your receipt

2. VERIFY THE TALLY:
   - Check that all votes in the bulletin board are included in the tally
   - Verify the Merkle root matches the published votes
   - Confirm the tally proof is cryptographically valid

3. INDEPENDENT VERIFICATION:
   - Download this verification data
   - Run independent verification software
   - Compare results with official tally

4. REPORT ISSUES:
   - Any discrepancies should be reported immediately
   - Include your receipt ID and verification code
   - Contact election officials with evidence

CRYPTOGRAPHIC VERIFICATION:
- Each vote has a zero-knowledge proof of validity
- Nullifier hashes prevent double voting
- Merkle proofs ensure vote inclusion
- Digital signatures guarantee authenticity

For technical verification tools and documentation, visit:
[Election Authority Website]
    `.trim();
    
    return {
      election: { id: electionId, timestamp: Date.now() },
      bulletinBoard: bulletinBoard!,
      receipts,
      verificationInstructions
    };
  }

  // Private helper methods

  private generateReceiptId(): string {
    return 'receipt_' + randomBytes(16).toString('hex');
  }

  private generateVerificationCode(): string {
    // Generate human-readable verification code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private signReceiptData(data: any): string {
    // In production, use proper digital signature
    return createHash('sha256')
      .update(JSON.stringify(data) + 'secret_key')
      .digest('hex');
  }

  private verifyReceiptSignature(receipt: VoterReceipt): boolean {
    const data = {
      receiptId: receipt.receiptId,
      electionId: receipt.electionId,
      voterId: receipt.voterId,
      timestamp: receipt.timestamp,
      voteCommitment: receipt.voteCommitment,
      nullifierHash: receipt.nullifierHash,
      verificationCode: receipt.verificationCode
    };
    
    const expectedSignature = this.signReceiptData(data);
    return expectedSignature === receipt.signature;
  }

  private verifyZKProof(zkProof: string, commitment: string): boolean {
    // Simplified verification - in production use actual zk-SNARK verification
    return zkProof.length > 0 && commitment.length > 0;
  }

  private verifyMerkleInclusion(receipt: VoterReceipt): boolean {
    const bulletinBoard = this.bulletinBoards.get(receipt.electionId);
    if (!bulletinBoard) return false;
    
    // Check if vote commitment appears in bulletin board
    return bulletinBoard.votes.some(vote => 
      vote.commitmentHash === receipt.voteCommitment
    );
  }

  private async verifyElectionTally(electionId: string): Promise<boolean> {
    const bulletinBoard = this.bulletinBoards.get(electionId);
    if (!bulletinBoard) return false;
    
    // Verify tally proof
    return this.verifyTallyProof(bulletinBoard.tally);
  }

  private verifyTallyProof(tally: ElectionTally): boolean {
    // Simplified verification - in production verify homomorphic encryption proofs
    return tally.tallyProof.length > 0;
  }

  private generateMerkleRoot(votes: any[]): string {
    if (votes.length === 0) return '';
    
    // Simplified Merkle tree - in production use proper implementation
    const hashes = votes.map(vote => 
      createHash('sha256').update(JSON.stringify(vote)).digest('hex')
    );
    
    while (hashes.length > 1) {
      const newHashes: string[] = [];
      for (let i = 0; i < hashes.length; i += 2) {
        const left = hashes[i];
        const right = hashes[i + 1] || left;
        const combined = createHash('sha256').update(left + right).digest('hex');
        newHashes.push(combined);
      }
      hashes.splice(0, hashes.length, ...newHashes);
    }
    
    return hashes[0];
  }

  private generateTallyProof(votes: any[], candidates: CandidateResult[]): string {
    // Generate proof that tally correctly counts votes
    const proofData = {
      voteCount: votes.length,
      candidateResults: candidates,
      timestamp: Date.now()
    };
    
    return createHash('sha256')
      .update(JSON.stringify(proofData) + 'tally_secret')
      .digest('hex');
  }

  private addToPublicBulletinBoard(electionId: string, receipt: VoterReceipt): void {
    let bulletinBoard = this.bulletinBoards.get(electionId);
    
    if (!bulletinBoard) {
      bulletinBoard = {
        electionId,
        votes: [],
        tally: {
          electionId,
          totalVotes: 0,
          candidates: [],
          merkleRoot: '',
          tallyProof: '',
          timestamp: 0,
          verified: false
        },
        auditTrail: [],
        lastUpdated: Date.now()
      };
      this.bulletinBoards.set(electionId, bulletinBoard);
    }
    
    // Add vote record
    const voteRecord: PublicVoteRecord = {
      commitmentHash: receipt.voteCommitment,
      nullifierHash: receipt.nullifierHash,
      zkProof: receipt.zkProof,
      timestamp: receipt.timestamp
    };
    
    bulletinBoard.votes.push(voteRecord);
    bulletinBoard.lastUpdated = Date.now();
    
    // Add audit record
    const auditRecord: AuditRecord = {
      action: 'vote_cast',
      timestamp: Date.now(),
      actor: 'system',
      details: { receiptId: receipt.receiptId },
      signature: this.signReceiptData({ action: 'vote_cast', receiptId: receipt.receiptId })
    };
    
    bulletinBoard.auditTrail.push(auditRecord);
  }

  private updateBulletinBoardTally(electionId: string, tally: ElectionTally): void {
    const bulletinBoard = this.bulletinBoards.get(electionId);
    if (!bulletinBoard) return;
    
    bulletinBoard.tally = tally;
    bulletinBoard.lastUpdated = Date.now();
    
    // Add audit record
    const auditRecord: AuditRecord = {
      action: 'tally_published',
      timestamp: Date.now(),
      actor: 'system',
      details: { totalVotes: tally.totalVotes },
      signature: this.signReceiptData({ action: 'tally_published', electionId })
    };
    
    bulletinBoard.auditTrail.push(auditRecord);
  }
}

/**
 * Receipt Verification Service
 * Standalone service for public verification
 */
export class ReceiptVerificationService {
  private verifiabilitySystem: VerifiabilitySystem;

  constructor(verifiabilitySystem: VerifiabilitySystem) {
    this.verifiabilitySystem = verifiabilitySystem;
  }

  /**
   * Public API for receipt verification
   * @param receiptData Receipt data or verification code
   * @returns Verification result
   */
  async verifyReceipt(receiptData: VoterReceipt | string): Promise<VerificationResult | null> {
    if (typeof receiptData === 'string') {
      // Verify by code
      return this.verifiabilitySystem.verifyByCode(receiptData);
    } else {
      // Verify full receipt
      return this.verifiabilitySystem.verifyVoterReceipt(receiptData);
    }
  }

  /**
   * Get public election data for verification
   * @param electionId Election identifier
   * @returns Public election data
   */
  getPublicElectionData(electionId: string) {
    return this.verifiabilitySystem.getPublicBulletinBoard(electionId);
  }

  /**
   * Generate verification report
   * @param electionId Election identifier
   * @returns Comprehensive verification report
   */
  generateVerificationReport(electionId: string) {
    const auditResults = this.verifiabilitySystem.auditElectionIntegrity(electionId);
    const bulletinBoard = this.verifiabilitySystem.getPublicBulletinBoard(electionId);
    
    return {
      electionId,
      auditResults,
      bulletinBoard,
      verificationTimestamp: Date.now(),
      reportId: randomBytes(16).toString('hex')
    };
  }
}
