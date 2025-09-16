/**
 * Homomorphic Encryption Implementation for Secure Voting
 * Provides end-to-end encryption where votes remain encrypted until tallying
 */

import { createHash, randomBytes } from 'crypto';
import * as forge from 'node-forge';

export interface EncryptedVote {
  ciphertext: string;
  publicKey: string;
  timestamp: number;
  proof: string;
}

export interface HomomorphicKeyPair {
  publicKey: string;
  privateKey: string;
  modulus: string;
}

export interface TallyResult {
  candidateId: string;
  encryptedTotal: string;
  decryptedTotal?: number;
}

/**
 * Simplified Homomorphic Encryption using RSA-based approach
 * In production, use libraries like SEAL, HElib, or TFHE
 */
export class HomomorphicEncryption {
  private keySize: number = 2048;

  /**
   * Generate homomorphic encryption key pair
   */
  generateKeyPair(): HomomorphicKeyPair {
    const keypair = forge.pki.rsa.generateKeyPair(this.keySize);
    
    return {
      publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
      privateKey: forge.pki.privateKeyToPem(keypair.privateKey),
      modulus: keypair.publicKey.n.toString()
    };
  }

  /**
   * Encrypt a vote using homomorphic encryption
   * @param vote Vote value (candidate index)
   * @param publicKeyPem Public key in PEM format
   * @returns Encrypted vote with proof
   */
  encryptVote(vote: number, publicKeyPem: string): EncryptedVote {
    const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
    
    // Add randomness to prevent pattern analysis
    const randomPadding = randomBytes(32);
    const paddedVote = Buffer.concat([
      Buffer.from([vote]),
      randomPadding
    ]);

    // Encrypt using RSA
    const encrypted = publicKey.encrypt(paddedVote.toString('base64'), 'RSA-OAEP');
    const ciphertext = forge.util.encode64(encrypted);

    // Generate zero-knowledge proof of valid vote
    const proof = this.generateVoteProof(vote, ciphertext, publicKeyPem);

    return {
      ciphertext,
      publicKey: publicKeyPem,
      timestamp: Date.now(),
      proof
    };
  }

  /**
   * Homomorphically add encrypted votes
   * @param encryptedVotes Array of encrypted votes
   * @returns Homomorphically summed result
   */
  homomorphicAdd(encryptedVotes: EncryptedVote[]): string {
    if (encryptedVotes.length === 0) return '';

    // In a real implementation, this would perform actual homomorphic addition
    // For demonstration, we'll combine the ciphertexts
    const combined = encryptedVotes.map(vote => vote.ciphertext).join('|');
    
    // Hash the combined result for consistency
    return createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Decrypt and tally homomorphically encrypted votes
   * @param encryptedTotal Homomorphically summed votes
   * @param encryptedVotes Original encrypted votes for verification
   * @param privateKeyPem Private key for decryption
   * @returns Decrypted tally results
   */
  decryptAndTally(
    encryptedTotal: string,
    encryptedVotes: EncryptedVote[],
    privateKeyPem: string
  ): TallyResult[] {
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    const candidateTallies = new Map<number, number>();

    // Decrypt individual votes for tallying
    // In production, this would use homomorphic properties to decrypt the sum directly
    for (const encryptedVote of encryptedVotes) {
      try {
        const decrypted = privateKey.decrypt(
          forge.util.decode64(encryptedVote.ciphertext),
          'RSA-OAEP'
        );
        
        const paddedVote = Buffer.from(decrypted, 'base64');
        const vote = paddedVote[0]; // Extract vote from padded data
        
        candidateTallies.set(vote, (candidateTallies.get(vote) || 0) + 1);
      } catch (error) {
        console.error('Failed to decrypt vote:', error);
      }
    }

    // Convert to result format
    const results: TallyResult[] = [];
    for (const [candidateId, count] of candidateTallies.entries()) {
      results.push({
        candidateId: candidateId.toString(),
        encryptedTotal: encryptedTotal,
        decryptedTotal: count
      });
    }

    return results;
  }

  /**
   * Verify encrypted vote integrity
   * @param encryptedVote Encrypted vote to verify
   * @returns Verification result
   */
  verifyVote(encryptedVote: EncryptedVote): boolean {
    // Verify timestamp is recent
    const now = Date.now();
    const voteAge = now - encryptedVote.timestamp;
    if (voteAge > 24 * 60 * 60 * 1000) { // 24 hours
      return false;
    }

    // Verify proof of valid vote
    return this.verifyVoteProof(
      encryptedVote.ciphertext,
      encryptedVote.proof,
      encryptedVote.publicKey
    );
  }

  /**
   * Generate zero-knowledge proof that vote is valid
   * @param vote Original vote value
   * @param ciphertext Encrypted vote
   * @param publicKeyPem Public key used for encryption
   * @returns Proof string
   */
  private generateVoteProof(vote: number, ciphertext: string, publicKeyPem: string): string {
    // Simplified proof - in production use proper ZK-SNARK libraries
    const proofData = {
      voteHash: createHash('sha256').update(vote.toString()).digest('hex'),
      ciphertextHash: createHash('sha256').update(ciphertext).digest('hex'),
      keyHash: createHash('sha256').update(publicKeyPem).digest('hex'),
      timestamp: Date.now()
    };

    return Buffer.from(JSON.stringify(proofData)).toString('base64');
  }

  /**
   * Verify zero-knowledge proof of valid vote
   * @param ciphertext Encrypted vote
   * @param proof Proof to verify
   * @param publicKeyPem Public key
   * @returns Verification result
   */
  private verifyVoteProof(ciphertext: string, proof: string, publicKeyPem: string): boolean {
    try {
      const proofData = JSON.parse(Buffer.from(proof, 'base64').toString());
      
      // Verify proof components
      const expectedCiphertextHash = createHash('sha256').update(ciphertext).digest('hex');
      const expectedKeyHash = createHash('sha256').update(publicKeyPem).digest('hex');
      
      return proofData.ciphertextHash === expectedCiphertextHash &&
             proofData.keyHash === expectedKeyHash &&
             proofData.timestamp > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create voter receipt for end-to-end verifiability
   * @param encryptedVote Encrypted vote
   * @param electionId Election identifier
   * @returns Voter receipt
   */
  createVoterReceipt(encryptedVote: EncryptedVote, electionId: string): string {
    const receiptData = {
      electionId,
      voteHash: createHash('sha256').update(encryptedVote.ciphertext).digest('hex'),
      timestamp: encryptedVote.timestamp,
      proof: encryptedVote.proof
    };

    return Buffer.from(JSON.stringify(receiptData)).toString('base64');
  }

  /**
   * Verify voter receipt
   * @param receipt Receipt to verify
   * @param encryptedVote Original encrypted vote
   * @param electionId Election identifier
   * @returns Verification result
   */
  verifyVoterReceipt(receipt: string, encryptedVote: EncryptedVote, electionId: string): boolean {
    try {
      const receiptData = JSON.parse(Buffer.from(receipt, 'base64').toString());
      const expectedHash = createHash('sha256').update(encryptedVote.ciphertext).digest('hex');
      
      return receiptData.electionId === electionId &&
             receiptData.voteHash === expectedHash &&
             receiptData.timestamp === encryptedVote.timestamp &&
             receiptData.proof === encryptedVote.proof;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Homomorphic Voting Manager
 * Orchestrates the entire encrypted voting process
 */
export class HomomorphicVotingManager {
  private encryption: HomomorphicEncryption;
  private electionKeys: Map<string, HomomorphicKeyPair>;

  constructor() {
    this.encryption = new HomomorphicEncryption();
    this.electionKeys = new Map();
  }

  /**
   * Initialize election with homomorphic encryption
   * @param electionId Election identifier
   * @returns Public key for vote encryption
   */
  initializeElection(electionId: string): string {
    const keyPair = this.encryption.generateKeyPair();
    this.electionKeys.set(electionId, keyPair);
    return keyPair.publicKey;
  }

  /**
   * Cast encrypted vote
   * @param electionId Election identifier
   * @param candidateIndex Candidate selection (0-based index)
   * @returns Encrypted vote and receipt
   */
  castVote(electionId: string, candidateIndex: number): {
    encryptedVote: EncryptedVote;
    receipt: string;
  } {
    const keyPair = this.electionKeys.get(electionId);
    if (!keyPair) {
      throw new Error('Election not initialized');
    }

    const encryptedVote = this.encryption.encryptVote(candidateIndex, keyPair.publicKey);
    const receipt = this.encryption.createVoterReceipt(encryptedVote, electionId);

    return { encryptedVote, receipt };
  }

  /**
   * Tally encrypted votes
   * @param electionId Election identifier
   * @param encryptedVotes All encrypted votes
   * @returns Tally results
   */
  tallyVotes(electionId: string, encryptedVotes: EncryptedVote[]): TallyResult[] {
    const keyPair = this.electionKeys.get(electionId);
    if (!keyPair) {
      throw new Error('Election not initialized');
    }

    // Verify all votes before tallying
    const validVotes = encryptedVotes.filter(vote => this.encryption.verifyVote(vote));
    
    // Homomorphically add all votes
    const encryptedTotal = this.encryption.homomorphicAdd(validVotes);
    
    // Decrypt and return results
    return this.encryption.decryptAndTally(encryptedTotal, validVotes, keyPair.privateKey);
  }

  /**
   * Verify voter receipt
   * @param electionId Election identifier
   * @param receipt Voter receipt
   * @param encryptedVote Original encrypted vote
   * @returns Verification result
   */
  verifyReceipt(electionId: string, receipt: string, encryptedVote: EncryptedVote): boolean {
    return this.encryption.verifyVoterReceipt(receipt, encryptedVote, electionId);
  }

  /**
   * Get election public key
   * @param electionId Election identifier
   * @returns Public key or null if not found
   */
  getElectionPublicKey(electionId: string): string | null {
    const keyPair = this.electionKeys.get(electionId);
    return keyPair ? keyPair.publicKey : null;
  }

  /**
   * Clean up election keys (call after election is complete and audited)
   * @param electionId Election identifier
   */
  cleanupElection(electionId: string): void {
    this.electionKeys.delete(electionId);
  }
}
