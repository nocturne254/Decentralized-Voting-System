/**
 * Live Tally System
 * Extends existing voting system with configurable real-time vote counting
 */

import { EventEmitter } from 'events';

export interface TallyConfiguration {
  tenantId: string;
  electionId: string;
  mode: 'live' | 'delayed' | 'admin_only' | 'disabled';
  delayMinutes?: number;
  updateInterval: number; // milliseconds
  enableDeltas: boolean;
  deltaInterval: number; // minutes for delta calculations
}

export interface LiveTallyData {
  electionId: string;
  timestamp: number;
  totalVotes: number;
  candidates: CandidateTally[];
  deltas?: TallyDelta[];
  lastUpdate: number;
  nextUpdate?: number;
}

export interface CandidateTally {
  candidateId: string;
  name: string;
  voteCount: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
}

export interface TallyDelta {
  candidateId: string;
  name: string;
  deltaVotes: number;
  deltaPercentage: number;
  timeframe: string; // e.g., "last 5 min"
}

export interface VoteCommitment {
  commitmentHash: string;
  nullifierHash: string;
  timestamp: number;
  blockNumber?: number;
  transactionHash?: string;
  verified: boolean;
}

/**
 * Live Tally Manager
 * Integrates with existing voting system to provide real-time tallying
 */
export class LiveTallyManager extends EventEmitter {
  private configurations: Map<string, TallyConfiguration> = new Map();
  private tallyData: Map<string, LiveTallyData> = new Map();
  private voteCommitments: Map<string, VoteCommitment[]> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private historicalData: Map<string, LiveTallyData[]> = new Map();

  constructor() {
    super();
  }

  /**
   * Configure live tally for an election
   * @param config Tally configuration
   */
  configureTally(config: TallyConfiguration): void {
    const key = `${config.tenantId}_${config.electionId}`;
    this.configurations.set(key, config);

    // Initialize tally data
    if (!this.tallyData.has(config.electionId)) {
      this.tallyData.set(config.electionId, {
        electionId: config.electionId,
        timestamp: Date.now(),
        totalVotes: 0,
        candidates: [],
        lastUpdate: Date.now()
      });
    }

    // Start update interval if live mode
    if (config.mode === 'live') {
      this.startLiveUpdates(config);
    }

    this.emit('tallyConfigured', { electionId: config.electionId, mode: config.mode });
  }

  /**
   * Record vote commitment (integrates with existing voting system)
   * @param electionId Election ID
   * @param commitment Vote commitment data
   */
  recordVoteCommitment(electionId: string, commitment: VoteCommitment): void {
    if (!this.voteCommitments.has(electionId)) {
      this.voteCommitments.set(electionId, []);
    }

    const commitments = this.voteCommitments.get(electionId)!;
    
    // Check for duplicate nullifier (prevent double voting)
    const existingCommitment = commitments.find(c => c.nullifierHash === commitment.nullifierHash);
    if (existingCommitment) {
      throw new Error('Duplicate vote detected');
    }

    commitments.push(commitment);
    this.voteCommitments.set(electionId, commitments);

    // Update tally if in live mode
    const config = this.getElectionConfig(electionId);
    if (config?.mode === 'live') {
      this.updateTallyData(electionId);
    }

    this.emit('voteRecorded', { electionId, commitment });
  }

  /**
   * Get current tally data
   * @param electionId Election ID
   * @param requestorRole User role (for access control)
   */
  getCurrentTally(electionId: string, requestorRole: 'voter' | 'admin' | 'observer'): LiveTallyData | null {
    const config = this.getElectionConfig(electionId);
    if (!config) return null;

    // Check access permissions
    if (!this.canAccessTally(config.mode, requestorRole)) {
      return null;
    }

    let tally = this.tallyData.get(electionId);
    if (!tally) return null;

    // Apply delay if configured
    if (config.mode === 'delayed' && config.delayMinutes) {
      const delayMs = config.delayMinutes * 60 * 1000;
      const cutoffTime = Date.now() - delayMs;
      tally = this.getDelayedTally(electionId, cutoffTime);
    }

    return tally;
  }

  /**
   * Get tally history for analytics
   * @param electionId Election ID
   * @param hours Number of hours of history
   */
  getTallyHistory(electionId: string, hours: number = 24): LiveTallyData[] {
    const history = this.historicalData.get(electionId) || [];
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    
    return history.filter(data => data.timestamp >= cutoff);
  }

  /**
   * Update tally configuration
   * @param electionId Election ID
   * @param updates Configuration updates
   */
  updateTallyConfig(electionId: string, updates: Partial<TallyConfiguration>): void {
    const config = this.getElectionConfig(electionId);
    if (!config) return;

    const updatedConfig = { ...config, ...updates };
    const key = `${config.tenantId}_${electionId}`;
    this.configurations.set(key, updatedConfig);

    // Restart intervals if mode changed
    if (updates.mode) {
      this.stopLiveUpdates(electionId);
      if (updates.mode === 'live') {
        this.startLiveUpdates(updatedConfig);
      }
    }

    this.emit('tallyConfigUpdated', { electionId, config: updatedConfig });
  }

  /**
   * Manually trigger tally update (admin function)
   * @param electionId Election ID
   */
  async forceTallyUpdate(electionId: string): Promise<LiveTallyData> {
    await this.updateTallyData(electionId);
    return this.tallyData.get(electionId)!;
  }

  /**
   * Get tally statistics
   * @param electionId Election ID
   */
  getTallyStatistics(electionId: string): {
    totalCommitments: number;
    verifiedVotes: number;
    pendingVerification: number;
    averageVotesPerHour: number;
    peakVotingHour: string;
    participationRate?: number;
  } {
    const commitments = this.voteCommitments.get(electionId) || [];
    const verifiedVotes = commitments.filter(c => c.verified).length;
    const pendingVerification = commitments.length - verifiedVotes;

    // Calculate voting rate
    const history = this.getTallyHistory(electionId, 24);
    const averageVotesPerHour = history.length > 0 ? 
      history[history.length - 1].totalVotes / 24 : 0;

    // Find peak voting hour
    const hourlyVotes = new Map<number, number>();
    commitments.forEach(c => {
      const hour = new Date(c.timestamp).getHours();
      hourlyVotes.set(hour, (hourlyVotes.get(hour) || 0) + 1);
    });

    const peakHour = Array.from(hourlyVotes.entries())
      .sort((a, b) => b[1] - a[1])[0];

    return {
      totalCommitments: commitments.length,
      verifiedVotes,
      pendingVerification,
      averageVotesPerHour,
      peakVotingHour: peakHour ? `${peakHour[0]}:00` : 'N/A'
    };
  }

  // Private methods

  private getElectionConfig(electionId: string): TallyConfiguration | null {
    // Find config by election ID (since we might not have tenant ID)
    for (const [key, config] of this.configurations.entries()) {
      if (config.electionId === electionId) {
        return config;
      }
    }
    return null;
  }

  private canAccessTally(mode: string, role: string): boolean {
    switch (mode) {
      case 'live':
      case 'delayed':
        return true; // All roles can access
      case 'admin_only':
        return role === 'admin';
      case 'disabled':
        return false;
      default:
        return false;
    }
  }

  private startLiveUpdates(config: TallyConfiguration): void {
    const interval = setInterval(() => {
      this.updateTallyData(config.electionId);
    }, config.updateInterval);

    this.updateIntervals.set(config.electionId, interval);
  }

  private stopLiveUpdates(electionId: string): void {
    const interval = this.updateIntervals.get(electionId);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(electionId);
    }
  }

  private async updateTallyData(electionId: string): Promise<void> {
    const commitments = this.voteCommitments.get(electionId) || [];
    const config = this.getElectionConfig(electionId);
    
    if (!config) return;

    // Count votes by candidate (this would integrate with your existing vote decryption)
    const candidateVotes = await this.countVotesByCandidate(electionId, commitments);
    const totalVotes = candidateVotes.reduce((sum, c) => sum + c.voteCount, 0);

    // Calculate percentages and trends
    const previousTally = this.tallyData.get(electionId);
    const candidates: CandidateTally[] = candidateVotes.map(candidate => {
      const percentage = totalVotes > 0 ? (candidate.voteCount / totalVotes) * 100 : 0;
      
      // Calculate trend
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (previousTally) {
        const previousCandidate = previousTally.candidates.find(c => c.candidateId === candidate.candidateId);
        if (previousCandidate) {
          if (candidate.voteCount > previousCandidate.voteCount) trend = 'up';
          else if (candidate.voteCount < previousCandidate.voteCount) trend = 'down';
        }
      }

      return {
        candidateId: candidate.candidateId,
        name: candidate.name,
        voteCount: candidate.voteCount,
        percentage,
        trend
      };
    });

    // Calculate deltas if enabled
    let deltas: TallyDelta[] | undefined;
    if (config.enableDeltas) {
      deltas = this.calculateDeltas(electionId, candidates, config.deltaInterval);
    }

    const newTally: LiveTallyData = {
      electionId,
      timestamp: Date.now(),
      totalVotes,
      candidates,
      deltas,
      lastUpdate: Date.now(),
      nextUpdate: config.mode === 'live' ? Date.now() + config.updateInterval : undefined
    };

    // Store current tally
    this.tallyData.set(electionId, newTally);

    // Add to historical data
    if (!this.historicalData.has(electionId)) {
      this.historicalData.set(electionId, []);
    }
    const history = this.historicalData.get(electionId)!;
    history.push(newTally);

    // Keep only last 48 hours of history
    const cutoff = Date.now() - (48 * 60 * 60 * 1000);
    this.historicalData.set(electionId, history.filter(h => h.timestamp >= cutoff));

    this.emit('tallyUpdated', newTally);
  }

  private async countVotesByCandidate(electionId: string, commitments: VoteCommitment[]): Promise<{
    candidateId: string;
    name: string;
    voteCount: number;
  }[]> {
    // This would integrate with your existing homomorphic encryption system
    // to decrypt and count votes while maintaining privacy
    
    // For now, simulate vote counting
    const candidateMap = new Map<string, number>();
    
    // In production, this would:
    // 1. Decrypt vote commitments using homomorphic encryption
    // 2. Verify zero-knowledge proofs
    // 3. Count votes per candidate
    
    // Simulate some candidates and random vote distribution
    const simulatedCandidates = ['candidate_1', 'candidate_2', 'candidate_3'];
    
    commitments.forEach(commitment => {
      if (commitment.verified) {
        // Simulate vote extraction from commitment
        const candidateId = simulatedCandidates[Math.floor(Math.random() * simulatedCandidates.length)];
        candidateMap.set(candidateId, (candidateMap.get(candidateId) || 0) + 1);
      }
    });

    return Array.from(candidateMap.entries()).map(([candidateId, count]) => ({
      candidateId,
      name: `Candidate ${candidateId.split('_')[1]}`,
      voteCount: count
    }));
  }

  private calculateDeltas(electionId: string, currentCandidates: CandidateTally[], deltaMinutes: number): TallyDelta[] {
    const history = this.historicalData.get(electionId) || [];
    const cutoff = Date.now() - (deltaMinutes * 60 * 1000);
    
    // Find the closest historical data point to the cutoff
    const baselineData = history
      .filter(h => h.timestamp >= cutoff)
      .sort((a, b) => Math.abs(a.timestamp - cutoff) - Math.abs(b.timestamp - cutoff))[0];

    if (!baselineData) {
      return currentCandidates.map(c => ({
        candidateId: c.candidateId,
        name: c.name,
        deltaVotes: c.voteCount,
        deltaPercentage: c.percentage,
        timeframe: `last ${deltaMinutes} min`
      }));
    }

    return currentCandidates.map(current => {
      const baseline = baselineData.candidates.find(c => c.candidateId === current.candidateId);
      const deltaVotes = baseline ? current.voteCount - baseline.voteCount : current.voteCount;
      const deltaPercentage = baseline ? current.percentage - baseline.percentage : current.percentage;

      return {
        candidateId: current.candidateId,
        name: current.name,
        deltaVotes,
        deltaPercentage,
        timeframe: `last ${deltaMinutes} min`
      };
    });
  }

  private getDelayedTally(electionId: string, cutoffTime: number): LiveTallyData | null {
    const history = this.historicalData.get(electionId) || [];
    
    // Find the most recent tally before the cutoff time
    const delayedData = history
      .filter(h => h.timestamp <= cutoffTime)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    return delayedData || null;
  }

  /**
   * Integration method for existing voting system
   * Call this when a vote is cast in the existing system
   */
  integrateWithExistingVote(electionId: string, voteData: {
    voterHash: string;
    encryptedVote: string;
    zkProof: string;
    blockNumber?: number;
    transactionHash?: string;
  }): void {
    const commitment: VoteCommitment = {
      commitmentHash: voteData.encryptedVote,
      nullifierHash: voteData.voterHash,
      timestamp: Date.now(),
      blockNumber: voteData.blockNumber,
      transactionHash: voteData.transactionHash,
      verified: true // Assume verification is done in existing system
    };

    this.recordVoteCommitment(electionId, commitment);
  }
}
