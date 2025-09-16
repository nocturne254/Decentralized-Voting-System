/**
 * Feature Integration Layer
 * Connects new features with existing blockchain voting system
 */

import { CandidateEnhancementManager } from '../features/candidate-enhancement';
import { LiveTallyManager } from '../features/live-tally';
import { ManifestoTrackerManager } from '../features/manifesto-tracker';
import { UIEnhancementManager } from '../features/ui-enhancements';

export interface TenantConfiguration {
  tenantId: string;
  organizationName: string;
  features: {
    liveTally: 'live' | 'delayed' | 'admin_only' | 'disabled';
    manifestoTracker: boolean;
    anonymousRatings: boolean;
    candidatePhotos: boolean;
    richManifestos: boolean;
    uiEnhancements: boolean;
  };
  settings: {
    delayMinutes?: number;
    gracePeriodSeconds: number;
    autoSaveInterval: number;
    rateLimitPerUser: number;
    minRatingsForDisplay: number;
  };
  dataRegion: string;
}

/**
 * Enhanced Voting System
 * Integrates all new features with existing blockchain voting infrastructure
 */
export class EnhancedVotingSystem {
  private candidateManager: CandidateEnhancementManager;
  private tallyManager: LiveTallyManager;
  private trackerManager: ManifestoTrackerManager;
  private uiManager: UIEnhancementManager;
  private tenantConfigs: Map<string, TenantConfiguration> = new Map();

  constructor() {
    this.candidateManager = new CandidateEnhancementManager();
    this.tallyManager = new LiveTallyManager();
    this.trackerManager = new ManifestoTrackerManager();
    
    // Initialize with default UI config
    this.uiManager = new UIEnhancementManager({
      tenantId: 'default',
      features: {
        confirmationGracePeriod: true,
        voterReceipts: true,
        darkMode: true,
        searchAndFilter: true,
        progressiveDisclosure: true,
        offlineQueueing: true,
        sessionContinuity: true
      },
      gracePeriodSeconds: 20,
      autoSaveInterval: 30000
    });

    this.setupEventListeners();
  }

  /**
   * Configure tenant with new features
   * @param config Tenant configuration
   */
  configureTenant(config: TenantConfiguration): void {
    this.tenantConfigs.set(config.tenantId, config);

    // Configure live tally if enabled
    if (config.features.liveTally !== 'disabled') {
      this.tallyManager.configureTally({
        tenantId: config.tenantId,
        electionId: '', // Will be set per election
        mode: config.features.liveTally,
        delayMinutes: config.settings.delayMinutes,
        updateInterval: 5000, // 5 seconds
        enableDeltas: true,
        deltaInterval: 5 // 5 minutes
      });
    }

    // Configure manifesto tracker if enabled
    if (config.features.manifestoTracker) {
      this.trackerManager.configureTracker({
        tenantId: config.tenantId,
        enabled: true,
        anonymousRatings: config.features.anonymousRatings,
        ratingPeriods: ['post-election', '6-months', '1-year'],
        minRatingsForDisplay: config.settings.minRatingsForDisplay,
        rateLimitPerUser: config.settings.rateLimitPerUser,
        moderationEnabled: true
      });
    }
  }

  /**
   * Enhanced vote casting that integrates with existing system
   * @param voteData Vote data from existing system
   * @param tenantId Tenant ID
   */
  async castEnhancedVote(voteData: {
    electionId: string;
    candidateId: string;
    voterHash: string;
    encryptedVote: string;
    zkProof: string;
  }, tenantId: string): Promise<{
    voteConfirmation: any;
    receipt?: any;
    tallyUpdate?: any;
  }> {
    const config = this.tenantConfigs.get(tenantId);
    if (!config) {
      throw new Error('Tenant not configured');
    }

    // Get candidate information
    const candidate = this.candidateManager.getEnhancedCandidate(voteData.candidateId);
    const candidateName = candidate?.name || `Candidate ${voteData.candidateId}`;

    // Handle vote with grace period if UI enhancements enabled
    let voteConfirmation;
    if (config.features.uiEnhancements) {
      voteConfirmation = await this.uiManager.handleVoteWithGracePeriod({
        candidateId: voteData.candidateId,
        candidateName,
        voterHash: voteData.voterHash,
        encryptedVote: voteData.encryptedVote
      });
    }

    // Record vote commitment for live tally
    if (config.features.liveTally !== 'disabled') {
      this.tallyManager.integrateWithExistingVote(voteData.electionId, {
        voterHash: voteData.voterHash,
        encryptedVote: voteData.encryptedVote,
        zkProof: voteData.zkProof
      });
    }

    // Generate voter receipt if enabled
    let receipt;
    if (config.features.uiEnhancements) {
      receipt = await this.uiManager.generateVoterReceipt({
        electionId: voteData.electionId,
        voterHash: voteData.voterHash,
        voteHash: voteData.encryptedVote
      });
    }

    // Get updated tally
    let tallyUpdate;
    if (config.features.liveTally === 'live') {
      tallyUpdate = this.tallyManager.getCurrentTally(voteData.electionId, 'voter');
    }

    return {
      voteConfirmation,
      receipt,
      tallyUpdate
    };
  }

  /**
   * Enhanced candidate creation
   * @param candidateData Candidate data
   * @param tenantId Tenant ID
   */
  async createEnhancedCandidate(candidateData: {
    id: string;
    name: string;
    electionId: string;
    title?: string;
    affiliation?: string;
    shortSummary?: string;
    metadata?: any;
  }, tenantId: string): Promise<any> {
    const config = this.tenantConfigs.get(tenantId);
    if (!config) {
      throw new Error('Tenant not configured');
    }

    // Create enhanced candidate
    const candidate = await this.candidateManager.enhanceCandidate(candidateData.id, {
      ...candidateData,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    return candidate;
  }

  /**
   * Upload candidate photo
   * @param candidateId Candidate ID
   * @param photoFile Photo file
   * @param altText Alt text for accessibility
   * @param tenantId Tenant ID
   */
  async uploadCandidatePhoto(
    candidateId: string, 
    photoFile: File, 
    altText: string, 
    tenantId: string
  ): Promise<any> {
    const config = this.tenantConfigs.get(tenantId);
    if (!config?.features.candidatePhotos) {
      throw new Error('Candidate photos not enabled for this tenant');
    }

    return this.candidateManager.uploadCandidatePhoto(candidateId, photoFile, altText);
  }

  /**
   * Create candidate manifesto
   * @param candidateId Candidate ID
   * @param manifestoData Manifesto content
   * @param tenantId Tenant ID
   */
  async createCandidateManifesto(
    candidateId: string,
    manifestoData: {
      content: string;
      attachments?: File[];
      pledges?: any[];
    },
    tenantId: string
  ): Promise<any> {
    const config = this.tenantConfigs.get(tenantId);
    if (!config?.features.richManifestos) {
      throw new Error('Rich manifestos not enabled for this tenant');
    }

    return this.candidateManager.createManifesto(candidateId, {
      ...manifestoData,
      tenantId
    });
  }

  /**
   * Submit pledge rating
   * @param ratingData Rating data
   * @param tenantId Tenant ID
   */
  async submitPledgeRating(ratingData: {
    candidateId: string;
    pledgeId: string;
    raterId: string;
    score: number;
    ratingPeriod: string;
  }, tenantId: string): Promise<any> {
    const config = this.tenantConfigs.get(tenantId);
    if (!config?.features.manifestoTracker) {
      throw new Error('Manifesto tracker not enabled for this tenant');
    }

    return this.trackerManager.submitRating({
      ...ratingData,
      tenantId,
      anonymous: config.features.anonymousRatings
    });
  }

  /**
   * Get enhanced ballot data for voter interface
   * @param electionId Election ID
   * @param tenantId Tenant ID
   * @param voterRole Voter role for access control
   */
  async getEnhancedBallot(electionId: string, tenantId: string, voterRole: string = 'voter'): Promise<{
    candidates: any[];
    liveTally?: any;
    configuration: any;
  }> {
    const config = this.tenantConfigs.get(tenantId);
    if (!config) {
      throw new Error('Tenant not configured');
    }

    // Get candidates with enhancements
    const candidates = await this.getElectionCandidates(electionId);
    const enhancedCandidates = candidates.map(candidate => {
      const enhancement = this.candidateManager.generateCandidateCard(candidate.id);
      return {
        ...candidate,
        ...enhancement
      };
    });

    // Get live tally if enabled and accessible
    let liveTally;
    if (config.features.liveTally !== 'disabled') {
      liveTally = this.tallyManager.getCurrentTally(electionId, voterRole as any);
    }

    return {
      candidates: enhancedCandidates,
      liveTally,
      configuration: {
        features: config.features,
        settings: config.settings
      }
    };
  }

  /**
   * Get candidate performance data
   * @param candidateId Candidate ID
   * @param tenantId Tenant ID
   */
  async getCandidatePerformance(candidateId: string, tenantId: string): Promise<any> {
    const config = this.tenantConfigs.get(tenantId);
    if (!config?.features.manifestoTracker) {
      return null;
    }

    return this.trackerManager.getCandidatePerformance(candidateId, tenantId);
  }

  /**
   * Get election results with enhancements
   * @param electionId Election ID
   * @param tenantId Tenant ID
   * @param requestorRole Requestor role
   */
  async getEnhancedResults(electionId: string, tenantId: string, requestorRole: string = 'voter'): Promise<{
    tally: any;
    candidates: any[];
    statistics: any;
    performance?: any;
  }> {
    const config = this.tenantConfigs.get(tenantId);
    if (!config) {
      throw new Error('Tenant not configured');
    }

    // Get current tally
    const tally = this.tallyManager.getCurrentTally(electionId, requestorRole as any);
    
    // Get enhanced candidate data
    const candidates = await this.getElectionCandidates(electionId);
    const enhancedCandidates = candidates.map(candidate => {
      const enhancement = this.candidateManager.generateCandidateCard(candidate.id);
      return {
        ...candidate,
        ...enhancement
      };
    });

    // Get statistics
    const statistics = this.tallyManager.getTallyStatistics(electionId);

    // Get performance analytics if enabled
    let performance;
    if (config.features.manifestoTracker) {
      performance = this.trackerManager.getPerformanceAnalytics(tenantId);
    }

    return {
      tally,
      candidates: enhancedCandidates,
      statistics,
      performance
    };
  }

  /**
   * Setup event listeners for feature integration
   */
  private setupEventListeners(): void {
    // Listen for tally updates
    this.tallyManager.on('tallyUpdated', (tally) => {
      // Broadcast to connected clients (integrate with existing WebSocket system)
      this.broadcastTallyUpdate(tally);
    });

    // Listen for new ratings
    this.trackerManager.on?.('ratingSubmitted', (rating) => {
      // Update performance metrics
      console.log('New rating submitted:', rating);
    });

    // Listen for vote confirmations
    this.uiManager.on?.('voteConfirmed', (vote) => {
      // Process with existing blockchain system
      this.processVoteWithBlockchain(vote);
    });
  }

  /**
   * Integration with existing election system
   * @param electionId Election ID
   */
  private async getElectionCandidates(electionId: string): Promise<any[]> {
    // This would integrate with your existing election/candidate system
    // For now, return mock data
    return [
      { id: 'candidate_1', name: 'Alice Johnson', electionId },
      { id: 'candidate_2', name: 'Bob Smith', electionId },
      { id: 'candidate_3', name: 'Carol Davis', electionId }
    ];
  }

  /**
   * Broadcast tally updates to connected clients
   * @param tally Tally data
   */
  private broadcastTallyUpdate(tally: any): void {
    // This would integrate with your existing WebSocket/SSE system
    console.log('Broadcasting tally update:', tally.electionId);
  }

  /**
   * Process vote with existing blockchain system
   * @param vote Vote data
   */
  private processVoteWithBlockchain(vote: any): void {
    // This would integrate with your existing blockchain voting system
    console.log('Processing vote with blockchain:', vote);
  }

  /**
   * Get tenant configuration
   * @param tenantId Tenant ID
   */
  getTenantConfiguration(tenantId: string): TenantConfiguration | null {
    return this.tenantConfigs.get(tenantId) || null;
  }

  /**
   * Update tenant configuration
   * @param tenantId Tenant ID
   * @param updates Configuration updates
   */
  updateTenantConfiguration(tenantId: string, updates: Partial<TenantConfiguration>): void {
    const existing = this.tenantConfigs.get(tenantId);
    if (!existing) {
      throw new Error('Tenant not found');
    }

    const updated = { ...existing, ...updates };
    this.tenantConfigs.set(tenantId, updated);

    // Reconfigure services
    this.configureTenant(updated);
  }

  /**
   * Export tenant data for compliance
   * @param tenantId Tenant ID
   */
  async exportTenantData(tenantId: string): Promise<{
    configuration: TenantConfiguration;
    candidates: any[];
    manifestos: any[];
    ratings: any[];
    tallies: any[];
  }> {
    const config = this.tenantConfigs.get(tenantId);
    if (!config) {
      throw new Error('Tenant not found');
    }

    // Collect all tenant data
    const candidates: any[] = [];
    const manifestos: any[] = [];
    
    // Get performance data if enabled
    let ratings: any[] = [];
    if (config.features.manifestoTracker) {
      const exportData = this.trackerManager.exportPerformanceData(tenantId, true);
      ratings = exportData.ratings;
    }

    // Get tally history
    const tallies: any[] = [];
    // This would collect tally data for all elections

    return {
      configuration: config,
      candidates,
      manifestos,
      ratings,
      tallies
    };
  }
}

/**
 * Factory function to create enhanced voting system
 * @param existingSystem Reference to existing blockchain voting system
 */
export function createEnhancedVotingSystem(existingSystem?: any): EnhancedVotingSystem {
  const enhanced = new EnhancedVotingSystem();
  
  // If existing system provided, set up integration hooks
  if (existingSystem) {
    // Hook into existing vote processing
    const originalCastVote = existingSystem.castVote;
    existingSystem.castVote = async function(voteData: any, tenantId: string) {
      // Process with existing system first
      const result = await originalCastVote.call(this, voteData);
      
      // Then enhance with new features
      const enhancement = await enhanced.castEnhancedVote(voteData, tenantId);
      
      return { ...result, ...enhancement };
    };

    // Hook into existing candidate creation
    const originalCreateCandidate = existingSystem.createCandidate;
    existingSystem.createCandidate = async function(candidateData: any, tenantId: string) {
      // Create with existing system first
      const result = await originalCreateCandidate.call(this, candidateData);
      
      // Then enhance
      const enhancement = await enhanced.createEnhancedCandidate(candidateData, tenantId);
      
      return { ...result, ...enhancement };
    };
  }
  
  return enhanced;
}

// Export for global access
export default EnhancedVotingSystem;
