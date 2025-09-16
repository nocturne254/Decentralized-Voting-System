/**
 * Manifesto Performance Tracker
 * Optional rating system for candidate pledge performance
 */

import { createHash } from 'crypto';

export interface PledgeRating {
  ratingId: string;
  tenantId: string;
  candidateId: string;
  pledgeId: string;
  raterId: string; // Hashed voter ID for anonymity
  score: number; // 0-100
  timestamp: number;
  anonymous: boolean;
  ratingPeriod: string; // e.g., "post-election", "6-months", "1-year"
}

export interface PledgePerformance {
  pledgeId: string;
  candidateId: string;
  title: string;
  description: string;
  category: string;
  averageScore: number;
  totalRatings: number;
  scoreDistribution: { [score: number]: number };
  trend: 'improving' | 'declining' | 'stable';
  lastUpdated: number;
}

export interface CandidatePerformance {
  candidateId: string;
  name: string;
  overallScore: number;
  pledgePerformances: PledgePerformance[];
  totalRatings: number;
  ratingPeriods: string[];
  lastRated: number;
}

export interface TrackerConfiguration {
  tenantId: string;
  enabled: boolean;
  anonymousRatings: boolean;
  ratingPeriods: string[];
  minRatingsForDisplay: number;
  rateLimitPerUser: number; // ratings per day
  moderationEnabled: boolean;
}

/**
 * Manifesto Performance Tracker Manager
 * Integrates with existing candidate system to track pledge performance
 */
export class ManifestoTrackerManager {
  private configurations: Map<string, TrackerConfiguration> = new Map();
  private ratings: Map<string, PledgeRating[]> = new Map();
  private performances: Map<string, PledgePerformance> = new Map();
  private rateLimits: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * Configure tracker for tenant
   * @param config Tracker configuration
   */
  configureTracker(config: TrackerConfiguration): void {
    this.configurations.set(config.tenantId, config);
  }

  /**
   * Submit rating for a pledge
   * @param rating Rating data
   */
  async submitRating(rating: Omit<PledgeRating, 'ratingId' | 'timestamp'>): Promise<PledgeRating> {
    const config = this.configurations.get(rating.tenantId);
    if (!config?.enabled) {
      throw new Error('Manifesto tracker not enabled for this tenant');
    }

    // Check rate limiting
    await this.checkRateLimit(rating.raterId, config.rateLimitPerUser);

    // Validate score
    if (rating.score < 0 || rating.score > 100) {
      throw new Error('Score must be between 0 and 100');
    }

    // Check for duplicate rating
    const existingRating = await this.findExistingRating(
      rating.tenantId,
      rating.pledgeId,
      rating.raterId,
      rating.ratingPeriod
    );

    if (existingRating) {
      throw new Error('You have already rated this pledge for this period');
    }

    // Create rating record
    const newRating: PledgeRating = {
      ...rating,
      ratingId: this.generateRatingId(),
      timestamp: Date.now()
    };

    // Store rating
    const pledgeKey = `${rating.tenantId}_${rating.pledgeId}`;
    if (!this.ratings.has(pledgeKey)) {
      this.ratings.set(pledgeKey, []);
    }
    this.ratings.get(pledgeKey)!.push(newRating);

    // Update performance metrics
    await this.updatePledgePerformance(rating.pledgeId, rating.tenantId);

    // Update rate limit
    this.updateRateLimit(rating.raterId);

    return newRating;
  }

  /**
   * Get pledge performance data
   * @param pledgeId Pledge ID
   * @param tenantId Tenant ID
   */
  getPledgePerformance(pledgeId: string, tenantId: string): PledgePerformance | null {
    const key = `${tenantId}_${pledgeId}`;
    return this.performances.get(key) || null;
  }

  /**
   * Get candidate performance summary
   * @param candidateId Candidate ID
   * @param tenantId Tenant ID
   */
  async getCandidatePerformance(candidateId: string, tenantId: string): Promise<CandidatePerformance | null> {
    // Get all pledges for this candidate (integrate with candidate enhancement system)
    const pledges = await this.getCandidatePledges(candidateId, tenantId);
    
    if (pledges.length === 0) return null;

    const pledgePerformances: PledgePerformance[] = [];
    let totalScore = 0;
    let totalRatings = 0;
    let lastRated = 0;
    const ratingPeriods = new Set<string>();

    for (const pledge of pledges) {
      const performance = this.getPledgePerformance(pledge.pledgeId, tenantId);
      if (performance) {
        pledgePerformances.push(performance);
        totalScore += performance.averageScore * performance.totalRatings;
        totalRatings += performance.totalRatings;
        lastRated = Math.max(lastRated, performance.lastUpdated);

        // Collect rating periods
        const pledgeRatings = this.getPledgeRatings(pledge.pledgeId, tenantId);
        pledgeRatings.forEach(r => ratingPeriods.add(r.ratingPeriod));
      }
    }

    const overallScore = totalRatings > 0 ? totalScore / totalRatings : 0;

    return {
      candidateId,
      name: await this.getCandidateName(candidateId),
      overallScore,
      pledgePerformances,
      totalRatings,
      ratingPeriods: Array.from(ratingPeriods),
      lastRated
    };
  }

  /**
   * Get performance analytics for tenant
   * @param tenantId Tenant ID
   * @param period Optional time period filter
   */
  getPerformanceAnalytics(tenantId: string, period?: string): {
    totalRatings: number;
    averageScore: number;
    topPerformers: { candidateId: string; name: string; score: number }[];
    categoryBreakdown: { [category: string]: { averageScore: number; count: number } };
    ratingTrends: { period: string; averageScore: number; count: number }[];
  } {
    const config = this.configurations.get(tenantId);
    if (!config?.enabled) {
      throw new Error('Tracker not enabled');
    }

    // Collect all ratings for tenant
    const allRatings: PledgeRating[] = [];
    for (const [key, ratings] of this.ratings.entries()) {
      if (key.startsWith(`${tenantId}_`)) {
        const filteredRatings = period ? 
          ratings.filter(r => r.ratingPeriod === period) : ratings;
        allRatings.push(...filteredRatings);
      }
    }

    const totalRatings = allRatings.length;
    const averageScore = totalRatings > 0 ? 
      allRatings.reduce((sum, r) => sum + r.score, 0) / totalRatings : 0;

    // Calculate top performers
    const candidateScores = new Map<string, { total: number; count: number; name: string }>();
    
    for (const rating of allRatings) {
      if (!candidateScores.has(rating.candidateId)) {
        candidateScores.set(rating.candidateId, {
          total: 0,
          count: 0,
          name: '' // Will be filled later
        });
      }
      const candidate = candidateScores.get(rating.candidateId)!;
      candidate.total += rating.score;
      candidate.count += 1;
    }

    const topPerformers = Array.from(candidateScores.entries())
      .map(([candidateId, data]) => ({
        candidateId,
        name: data.name || `Candidate ${candidateId}`,
        score: data.count > 0 ? data.total / data.count : 0
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // Category breakdown (would integrate with pledge categories)
    const categoryBreakdown: { [category: string]: { averageScore: number; count: number } } = {};
    
    // Rating trends by period
    const periodMap = new Map<string, { total: number; count: number }>();
    allRatings.forEach(rating => {
      if (!periodMap.has(rating.ratingPeriod)) {
        periodMap.set(rating.ratingPeriod, { total: 0, count: 0 });
      }
      const period = periodMap.get(rating.ratingPeriod)!;
      period.total += rating.score;
      period.count += 1;
    });

    const ratingTrends = Array.from(periodMap.entries()).map(([period, data]) => ({
      period,
      averageScore: data.count > 0 ? data.total / data.count : 0,
      count: data.count
    }));

    return {
      totalRatings,
      averageScore,
      topPerformers,
      categoryBreakdown,
      ratingTrends
    };
  }

  /**
   * Export performance data for transparency
   * @param tenantId Tenant ID
   * @param anonymize Whether to anonymize rater IDs
   */
  exportPerformanceData(tenantId: string, anonymize: boolean = true): {
    metadata: {
      tenantId: string;
      exportDate: string;
      totalRatings: number;
      anonymized: boolean;
    };
    ratings: Partial<PledgeRating>[];
    performances: PledgePerformance[];
  } {
    const config = this.configurations.get(tenantId);
    if (!config?.enabled) {
      throw new Error('Tracker not enabled');
    }

    // Collect all data for tenant
    const ratings: Partial<PledgeRating>[] = [];
    const performances: PledgePerformance[] = [];

    for (const [key, ratingList] of this.ratings.entries()) {
      if (key.startsWith(`${tenantId}_`)) {
        ratingList.forEach(rating => {
          const exportRating: Partial<PledgeRating> = {
            ratingId: rating.ratingId,
            candidateId: rating.candidateId,
            pledgeId: rating.pledgeId,
            score: rating.score,
            timestamp: rating.timestamp,
            ratingPeriod: rating.ratingPeriod
          };

          // Include rater ID only if not anonymizing
          if (!anonymize) {
            exportRating.raterId = rating.raterId;
          }

          ratings.push(exportRating);
        });
      }
    }

    for (const [key, performance] of this.performances.entries()) {
      if (key.startsWith(`${tenantId}_`)) {
        performances.push(performance);
      }
    }

    return {
      metadata: {
        tenantId,
        exportDate: new Date().toISOString(),
        totalRatings: ratings.length,
        anonymized: anonymize
      },
      ratings,
      performances
    };
  }

  // Private helper methods

  private generateRatingId(): string {
    return `rating_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async checkRateLimit(raterId: string, limit: number): Promise<void> {
    const now = Date.now();
    const dayStart = new Date(now).setHours(0, 0, 0, 0);
    
    let rateLimit = this.rateLimits.get(raterId);
    
    if (!rateLimit || rateLimit.resetTime < dayStart) {
      // Reset or create new rate limit
      rateLimit = { count: 0, resetTime: dayStart + 24 * 60 * 60 * 1000 };
      this.rateLimits.set(raterId, rateLimit);
    }

    if (rateLimit.count >= limit) {
      throw new Error('Rate limit exceeded. Please try again tomorrow.');
    }
  }

  private updateRateLimit(raterId: string): void {
    const rateLimit = this.rateLimits.get(raterId);
    if (rateLimit) {
      rateLimit.count += 1;
    }
  }

  private async findExistingRating(
    tenantId: string,
    pledgeId: string,
    raterId: string,
    ratingPeriod: string
  ): Promise<PledgeRating | null> {
    const key = `${tenantId}_${pledgeId}`;
    const ratings = this.ratings.get(key) || [];
    
    return ratings.find(r => 
      r.raterId === raterId && r.ratingPeriod === ratingPeriod
    ) || null;
  }

  private getPledgeRatings(pledgeId: string, tenantId: string): PledgeRating[] {
    const key = `${tenantId}_${pledgeId}`;
    return this.ratings.get(key) || [];
  }

  private async updatePledgePerformance(pledgeId: string, tenantId: string): Promise<void> {
    const ratings = this.getPledgeRatings(pledgeId, tenantId);
    const config = this.configurations.get(tenantId)!;

    if (ratings.length < config.minRatingsForDisplay) {
      return; // Not enough ratings to display performance
    }

    // Calculate average score
    const totalScore = ratings.reduce((sum, r) => sum + r.score, 0);
    const averageScore = totalScore / ratings.length;

    // Calculate score distribution
    const scoreDistribution: { [score: number]: number } = {};
    ratings.forEach(rating => {
      const bucket = Math.floor(rating.score / 10) * 10; // Group by 10s
      scoreDistribution[bucket] = (scoreDistribution[bucket] || 0) + 1;
    });

    // Calculate trend (compare recent ratings to older ones)
    const sortedRatings = ratings.sort((a, b) => a.timestamp - b.timestamp);
    const midpoint = Math.floor(sortedRatings.length / 2);
    const olderRatings = sortedRatings.slice(0, midpoint);
    const newerRatings = sortedRatings.slice(midpoint);

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (olderRatings.length > 0 && newerRatings.length > 0) {
      const olderAvg = olderRatings.reduce((sum, r) => sum + r.score, 0) / olderRatings.length;
      const newerAvg = newerRatings.reduce((sum, r) => sum + r.score, 0) / newerRatings.length;
      
      const difference = newerAvg - olderAvg;
      if (difference > 5) trend = 'improving';
      else if (difference < -5) trend = 'declining';
    }

    // Get pledge details (integrate with candidate enhancement system)
    const pledgeDetails = await this.getPledgeDetails(pledgeId, tenantId);

    const performance: PledgePerformance = {
      pledgeId,
      candidateId: pledgeDetails.candidateId,
      title: pledgeDetails.title,
      description: pledgeDetails.description,
      category: pledgeDetails.category,
      averageScore,
      totalRatings: ratings.length,
      scoreDistribution,
      trend,
      lastUpdated: Date.now()
    };

    const key = `${tenantId}_${pledgeId}`;
    this.performances.set(key, performance);
  }

  private async getCandidatePledges(candidateId: string, tenantId: string): Promise<{
    pledgeId: string;
    title: string;
    description: string;
    category: string;
  }[]> {
    // This would integrate with the candidate enhancement system
    // For now, return mock data
    return [
      {
        pledgeId: `pledge_${candidateId}_1`,
        title: 'Improve Infrastructure',
        description: 'Upgrade campus facilities',
        category: 'infrastructure'
      },
      {
        pledgeId: `pledge_${candidateId}_2`,
        title: 'Enhance Student Services',
        description: 'Better support for students',
        category: 'services'
      }
    ];
  }

  private async getPledgeDetails(pledgeId: string, tenantId: string): Promise<{
    candidateId: string;
    title: string;
    description: string;
    category: string;
  }> {
    // This would integrate with the candidate enhancement system
    // For now, return mock data
    return {
      candidateId: pledgeId.split('_')[1] || 'unknown',
      title: 'Sample Pledge',
      description: 'Sample pledge description',
      category: 'general'
    };
  }

  private async getCandidateName(candidateId: string): Promise<string> {
    // This would integrate with the candidate enhancement system
    // For now, return formatted name
    return `Candidate ${candidateId.split('_')[1] || candidateId}`;
  }

  /**
   * Integration method for existing authentication system
   * Generates anonymous rater ID from voter credentials
   */
  generateAnonymousRaterId(voterCredentials: {
    voterId: string;
    tenantId: string;
    electionId?: string;
  }): string {
    // Create deterministic but anonymous ID
    const data = `${voterCredentials.voterId}_${voterCredentials.tenantId}_tracker`;
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify rater eligibility (integrate with existing voter verification)
   */
  async verifyRaterEligibility(raterId: string, tenantId: string): Promise<boolean> {
    // This would integrate with existing voter verification system
    // For now, assume all raters are eligible
    return true;
  }
}
