/**
 * Decentralized Voting System JavaScript SDK
 * Provides easy integration with the voting API
 * Version: 1.0.0
 */

class VotingSDK {
    constructor(options = {}) {
        this.apiUrl = options.apiUrl || 'https://api.voting-system.com/api/v1';
        this.apiKey = options.apiKey;
        this.organizationId = options.organizationId;
        this.timeout = options.timeout || 10000;
        
        if (!this.apiKey) {
            throw new Error('API key is required');
        }
        
        if (!this.organizationId) {
            throw new Error('Organization ID is required');
        }
    }

    /**
     * Make authenticated API request
     * @private
     */
    async _request(endpoint, options = {}) {
        const url = `${this.apiUrl}${endpoint}`;
        const config = {
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey,
                'X-Organization-ID': this.organizationId,
                ...options.headers
            },
            ...options
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            
            const response = await fetch(url, {
                ...config,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new VotingSDKError(
                    errorData.message || `HTTP ${response.status}`,
                    response.status,
                    errorData
                );
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new VotingSDKError('Request timeout', 408);
            }
            if (error instanceof VotingSDKError) {
                throw error;
            }
            throw new VotingSDKError(`Network error: ${error.message}`, 0);
        }
    }

    /**
     * Get all elections
     * @param {Object} filters - Filter options
     * @returns {Promise<Object>} Elections data
     */
    async getElections(filters = {}) {
        const params = new URLSearchParams();
        
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                params.append(key, value);
            }
        });

        const queryString = params.toString();
        const endpoint = `/elections${queryString ? `?${queryString}` : ''}`;
        
        return await this._request(endpoint);
    }

    /**
     * Get specific election by ID
     * @param {string} electionId - Election ID
     * @returns {Promise<Object>} Election data
     */
    async getElection(electionId) {
        if (!electionId) {
            throw new VotingSDKError('Election ID is required');
        }
        
        return await this._request(`/elections/${electionId}`);
    }

    /**
     * Create new election
     * @param {Object} electionData - Election details
     * @returns {Promise<Object>} Created election
     */
    async createElection(electionData) {
        this._validateElectionData(electionData);
        
        return await this._request('/elections', {
            method: 'POST',
            body: JSON.stringify(electionData)
        });
    }

    /**
     * Update election
     * @param {string} electionId - Election ID
     * @param {Object} updates - Election updates
     * @returns {Promise<Object>} Updated election
     */
    async updateElection(electionId, updates) {
        if (!electionId) {
            throw new VotingSDKError('Election ID is required');
        }
        
        return await this._request(`/elections/${electionId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    }

    /**
     * Delete election
     * @param {string} electionId - Election ID
     * @returns {Promise<Object>} Deletion result
     */
    async deleteElection(electionId) {
        if (!electionId) {
            throw new VotingSDKError('Election ID is required');
        }
        
        return await this._request(`/elections/${electionId}`, {
            method: 'DELETE'
        });
    }

    /**
     * Cast vote in election
     * @param {string} electionId - Election ID
     * @param {Object} voteData - Vote details
     * @returns {Promise<Object>} Vote result
     */
    async castVote(electionId, voteData) {
        if (!electionId) {
            throw new VotingSDKError('Election ID is required');
        }
        
        this._validateVoteData(voteData);
        
        return await this._request(`/elections/${electionId}/vote`, {
            method: 'POST',
            body: JSON.stringify(voteData)
        });
    }

    /**
     * Get election results
     * @param {string} electionId - Election ID
     * @returns {Promise<Object>} Election results
     */
    async getResults(electionId) {
        if (!electionId) {
            throw new VotingSDKError('Election ID is required');
        }
        
        return await this._request(`/elections/${electionId}/results`);
    }

    /**
     * Get voter's vote history
     * @param {string} voterId - Voter ID
     * @returns {Promise<Object>} Vote history
     */
    async getVoteHistory(voterId) {
        if (!voterId) {
            throw new VotingSDKError('Voter ID is required');
        }
        
        return await this._request(`/voters/${voterId}/votes`);
    }

    /**
     * Check if voter has voted in election
     * @param {string} electionId - Election ID
     * @param {string} voterId - Voter ID
     * @returns {Promise<boolean>} Has voted status
     */
    async hasVoted(electionId, voterId) {
        if (!electionId || !voterId) {
            throw new VotingSDKError('Election ID and Voter ID are required');
        }
        
        try {
            const result = await this._request(`/elections/${electionId}/voters/${voterId}/status`);
            return result.data.hasVoted;
        } catch (error) {
            if (error.status === 404) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Get API health status
     * @returns {Promise<Object>} Health status
     */
    async getHealth() {
        return await this._request('/health');
    }

    /**
     * Validate election data
     * @private
     */
    _validateElectionData(data) {
        const required = ['title', 'description', 'candidates', 'startDate', 'endDate'];
        const missing = required.filter(field => !data[field]);
        
        if (missing.length > 0) {
            throw new VotingSDKError(`Missing required fields: ${missing.join(', ')}`);
        }

        if (!Array.isArray(data.candidates) || data.candidates.length < 2) {
            throw new VotingSDKError('At least 2 candidates are required');
        }

        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        
        if (startDate >= endDate) {
            throw new VotingSDKError('End date must be after start date');
        }
    }

    /**
     * Validate vote data
     * @private
     */
    _validateVoteData(data) {
        if (!data.candidateId) {
            throw new VotingSDKError('Candidate ID is required');
        }
        
        if (!data.voterId) {
            throw new VotingSDKError('Voter ID is required');
        }
    }
}

/**
 * Custom error class for SDK errors
 */
class VotingSDKError extends Error {
    constructor(message, status = 0, details = {}) {
        super(message);
        this.name = 'VotingSDKError';
        this.status = status;
        this.details = details;
    }
}

/**
 * Utility functions
 */
const VotingUtils = {
    /**
     * Format election for display
     */
    formatElection(election) {
        return {
            ...election,
            startDate: new Date(election.startDate),
            endDate: new Date(election.endDate),
            isActive: this.isElectionActive(election),
            timeRemaining: this.getTimeRemaining(election.endDate)
        };
    },

    /**
     * Check if election is currently active
     */
    isElectionActive(election) {
        const now = new Date();
        const start = new Date(election.startDate);
        const end = new Date(election.endDate);
        return now >= start && now <= end;
    },

    /**
     * Get time remaining in election
     */
    getTimeRemaining(endDate) {
        const now = new Date();
        const end = new Date(endDate);
        const diff = end - now;
        
        if (diff <= 0) return null;
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        return { days, hours, minutes, total: diff };
    },

    /**
     * Calculate vote percentages
     */
    calculatePercentages(results) {
        const total = results.reduce((sum, candidate) => sum + candidate.votes, 0);
        
        return results.map(candidate => ({
            ...candidate,
            percentage: total > 0 ? (candidate.votes / total * 100).toFixed(2) : 0
        }));
    },

    /**
     * Validate email format
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    /**
     * Generate unique voter ID
     */
    generateVoterId(prefix = 'voter') {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `${prefix}_${timestamp}_${random}`;
    }
};

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = { VotingSDK, VotingSDKError, VotingUtils };
} else if (typeof define === 'function' && define.amd) {
    // AMD
    define([], function() {
        return { VotingSDK, VotingSDKError, VotingUtils };
    });
} else {
    // Browser global
    window.VotingSDK = VotingSDK;
    window.VotingSDKError = VotingSDKError;
    window.VotingUtils = VotingUtils;
}

/**
 * Usage Examples:
 * 
 * // Initialize SDK
 * const sdk = new VotingSDK({
 *     apiUrl: 'https://api.voting-system.com/api/v1',
 *     apiKey: 'your-api-key',
 *     organizationId: 'your-org-id'
 * });
 * 
 * // Get all active elections
 * const elections = await sdk.getElections({ status: 'active' });
 * 
 * // Create new election
 * const newElection = await sdk.createElection({
 *     title: 'Student Council Election',
 *     description: 'Annual student council election',
 *     candidates: [
 *         { id: '1', name: 'John Doe', description: 'Senior student' },
 *         { id: '2', name: 'Jane Smith', description: 'Junior student' }
 *     ],
 *     startDate: '2024-03-01T00:00:00Z',
 *     endDate: '2024-03-07T23:59:59Z'
 * });
 * 
 * // Cast vote
 * const voteResult = await sdk.castVote('election-id', {
 *     candidateId: '1',
 *     voterId: 'voter-123'
 * });
 * 
 * // Get results
 * const results = await sdk.getResults('election-id');
 * const formattedResults = VotingUtils.calculatePercentages(results.data.candidates);
 */
