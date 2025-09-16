// Voter Component
import { AuthManager } from '../modules/auth.js';
import { BlockchainManager } from '../modules/blockchain.js';
import { UIManager } from '../modules/ui.js';

class VoterComponent {
  constructor() {
    this.authManager = new AuthManager();
    this.blockchainManager = new BlockchainManager();
    this.uiManager = new UIManager();
    this.selectedElection = null;
    this.selectedCandidate = null;
    this.init();
  }

  async init() {
    // Check authentication
    if (!this.authManager.isAuthenticated()) {
      window.location.href = 'login-modern.html';
      return;
    }

    try {
      // Initialize blockchain
      await this.blockchainManager.init();
      this.setupEventListeners();
      this.updateWalletInfo();
      this.loadElections();
      this.makeGloballyAccessible();
    } catch (error) {
      console.error('Voter initialization failed:', error);
      this.uiManager.showNotification('Failed to connect to blockchain', 'error');
    }
  }

  setupEventListeners() {
    // Wallet events
    const walletManager = this.blockchainManager.getWalletManager();
    walletManager.on('onAccountChange', async (_account) => {
      this.updateWalletInfo();
      this.loadElections(); // Reload to check vote status with new account
    });

    // Modal close events
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('voting-modal')) {
        this.closeVotingModal();
      }
    });
  }

  async loadElections() {
    const electionsList = document.getElementById('electionsList');
    this.uiManager.showLoading(electionsList, 'Loading elections...');

    try {
      const elections = await this.blockchainManager.getAllElections();
      
      if (elections.length === 0) {
        this.showEmptyState();
        return;
      }

      const electionsHTML = await Promise.all(
        elections.map(election => this.renderElectionCard(election))
      );
      
      electionsList.innerHTML = electionsHTML.join('');
      this.attachElectionEventListeners();

    } catch (error) {
      console.error('Failed to load elections:', error);
      electionsList.innerHTML = `
        <div class="text-center py-16 text-error-600">
          <i class="fas fa-exclamation-triangle text-5xl mb-4"></i>
          <h3>Failed to load elections</h3>
          <p>Please check your connection and try again</p>
          <button class="btn btn-primary mt-4" onclick="location.reload()">
            <i class="fas fa-sync-alt"></i>
            Retry
          </button>
        </div>
      `;
    }
  }

  async renderElectionCard(election) {
    const now = Math.floor(Date.now() / 1000);
    const status = this.getElectionStatus(election, now);
    const hasVoted = await this.blockchainManager.hasVoted(election.id);
    const totalVotes = election.candidates.reduce((sum, candidate) => sum + candidate.voteCount, 0);

    if (status.type === 'ended' || hasVoted) {
      return this.renderCompletedElection(election, status, hasVoted, totalVotes);
    } else if (status.type === 'active') {
      return this.renderActiveElection(election, status);
    } else {
      return this.renderUpcomingElection(election, status);
    }
  }

  renderActiveElection(election, status) {
    const candidatesHTML = election.candidates.map(candidate => `
      <div class="candidate-option" onclick="voterComponent.selectCandidate(${election.id}, ${candidate.id})">
        <input type="radio" name="election${election.id}" value="${candidate.id}" class="candidate-radio" id="candidate${election.id}_${candidate.id}">
        <div class="candidate-info">
          <div class="candidate-name">${candidate.name}</div>
          <div class="candidate-party">${candidate.party}</div>
        </div>
      </div>
    `).join('');

    return `
      <div class="election-card">
        <div class="election-header">
          <div class="election-meta">
            <h2 class="election-title">${election.name}</h2>
            <span class="election-status status-${status.type}">
              <i class="fas fa-circle"></i>
              ${status.label}
            </span>
          </div>
          <div class="election-dates">
            <i class="fas fa-calendar-alt"></i>
            <span>${this.uiManager.formatDate(election.startTime * 1000)} - ${this.uiManager.formatDate(election.endTime * 1000)}</span>
          </div>
        </div>
        
        <div class="election-content">
          <div class="candidates-list">
            ${candidatesHTML}
          </div>
          
          <div class="vote-actions">
            <button class="btn btn-secondary" onclick="voterComponent.viewResults(${election.id})">
              <i class="fas fa-chart-bar"></i>
              View Results
            </button>
            <button class="btn btn-primary" onclick="voterComponent.castVote(${election.id})" id="voteBtn${election.id}">
              <i class="fas fa-vote-yea"></i>
              Cast Vote
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderCompletedElection(election, status, hasVoted, totalVotes) {
    const statusClass = hasVoted ? 'status-voted' : `status-${status.type}`;
    const statusIcon = hasVoted ? 'fa-check' : (status.type === 'ended' ? 'fa-flag-checkered' : 'fa-circle');
    const statusLabel = hasVoted ? 'Voted' : status.label;

    const candidatesHTML = election.candidates.map(candidate => {
      const percentage = totalVotes > 0 ? Math.round((candidate.voteCount / totalVotes) * 100) : 0;
      const isWinner = candidate.voteCount === Math.max(...election.candidates.map(c => c.voteCount)) && totalVotes > 0;
      
      return `
        <div class="candidate-option ${isWinner ? 'border-success-300 bg-success-50' : ''}" style="cursor: default;">
          <div class="candidate-info">
            <div class="candidate-name">${candidate.name}</div>
            <div class="candidate-party">${candidate.party}</div>
            <div class="result-bar">
              <div class="result-fill" style="width: ${percentage}%;"></div>
            </div>
          </div>
          <div class="candidate-votes">
            ${isWinner ? '<strong>' : ''}${candidate.voteCount} votes (${percentage}%)${isWinner ? '</strong>' : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="election-card">
        <div class="election-header">
          <div class="election-meta">
            <h2 class="election-title">${election.name}</h2>
            <span class="election-status ${statusClass}">
              <i class="fas ${statusIcon}"></i>
              ${statusLabel}
            </span>
          </div>
          <div class="election-dates">
            <i class="fas fa-calendar-alt"></i>
            <span>${this.uiManager.formatDate(election.startTime * 1000)} - ${this.uiManager.formatDate(election.endTime * 1000)}</span>
          </div>
        </div>
        
        <div class="election-content">
          <div class="results-section">
            <div class="results-title">
              <i class="fas fa-trophy"></i>
              ${status.type === 'ended' ? 'Final Results' : 'Current Results'}
            </div>
            ${candidatesHTML}
          </div>
        </div>
      </div>
    `;
  }

  renderUpcomingElection(election, status) {
    return `
      <div class="election-card">
        <div class="election-header">
          <div class="election-meta">
            <h2 class="election-title">${election.name}</h2>
            <span class="election-status status-${status.type}">
              <i class="fas fa-clock"></i>
              ${status.label}
            </span>
          </div>
          <div class="election-dates">
            <i class="fas fa-calendar-alt"></i>
            <span>${this.uiManager.formatDate(election.startTime * 1000)} - ${this.uiManager.formatDate(election.endTime * 1000)}</span>
          </div>
        </div>
        
        <div class="election-content">
          <div class="text-center py-8 text-secondary-500">
            <i class="fas fa-hourglass-half text-5xl mb-4"></i>
            <p>Voting will begin on ${this.uiManager.formatDate(election.startTime * 1000, 'long')}</p>
            <p class="text-sm">Candidates: ${election.candidates.map(c => c.name).join(', ')}</p>
          </div>
        </div>
      </div>
    `;
  }

  attachElectionEventListeners() {
    // Make voterComponent globally accessible for onclick handlers
    window.voterComponent = this;
  }

  selectCandidate(electionId, candidateId) {
    // Remove previous selections
    document.querySelectorAll(`input[name="election${electionId}"]`).forEach(radio => {
      radio.closest('.candidate-option').classList.remove('selected');
    });
    
    // Select current candidate
    const radio = document.getElementById(`candidate${electionId}_${candidateId}`);
    if (radio) {
      radio.checked = true;
      radio.closest('.candidate-option').classList.add('selected');
    }
    
    this.selectedElection = electionId;
    this.selectedCandidate = candidateId;
  }

  async castVote(electionId) {
    if (!this.selectedCandidate || this.selectedElection !== electionId) {
      this.uiManager.showNotification('Please select a candidate before voting', 'warning');
      return;
    }

    try {
      // Get election details to show candidate name
      const election = await this.blockchainManager.getElection(electionId);
      const candidate = election.candidates.find(c => c.id === this.selectedCandidate);
      
      this.showVotingModal(candidate.name);
    } catch (error) {
      console.error('Failed to get election details:', error);
      this.uiManager.showNotification('Failed to load election details', 'error');
    }
  }

  showVotingModal(candidateName) {
    const modal = document.getElementById('votingModal');
    const confirmText = document.getElementById('voteConfirmText');
    
    if (confirmText) {
      confirmText.innerHTML = `Are you sure you want to vote for <strong>${candidateName}</strong>?`;
    }
    
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  async confirmVote() {
    const modal = document.getElementById('votingModal');
    const modalContent = modal.querySelector('.modal-content');
    
    // Show processing state
    modalContent.innerHTML = `
      <div class="modal-icon" style="background: var(--success-100); color: var(--success-600);">
        <div class="spinner"></div>
      </div>
      <h3>Processing Vote...</h3>
      <p>Please confirm the transaction in MetaMask</p>
    `;

    try {
      const result = await this.blockchainManager.castVote(this.selectedElection, this.selectedCandidate);
      
      // Show success state
      modalContent.innerHTML = `
        <div class="modal-icon" style="background: var(--success-100); color: var(--success-600);">
          <i class="fas fa-check"></i>
        </div>
        <h3>Vote Successful!</h3>
        <p>Your vote has been recorded on the blockchain.</p>
        <p class="text-sm text-secondary-600">Transaction: ${result.transactionHash.substring(0, 10)}...</p>
        <button class="btn btn-primary mt-4" onclick="voterComponent.closeVotingModal()">
          <i class="fas fa-check"></i>
          Done
        </button>
      `;

      // Reload elections to show updated state
      setTimeout(() => {
        this.loadElections();
      }, 2000);

    } catch (error) {
      console.error('Failed to cast vote:', error);
      
      // Show error state
      modalContent.innerHTML = `
        <div class="modal-icon" style="background: var(--error-100); color: var(--error-600);">
          <i class="fas fa-times"></i>
        </div>
        <h3>Vote Failed</h3>
        <p>There was an error processing your vote. Please try again.</p>
        <button class="btn btn-primary mt-4" onclick="voterComponent.closeVotingModal()">
          <i class="fas fa-arrow-left"></i>
          Back
        </button>
      `;
    }
  }

  closeVotingModal() {
    const modal = document.getElementById('votingModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  viewResults(_electionId) {
    this.uiManager.showNotification('Results are visible in the election card below', 'info');
  }

  showEmptyState() {
    const electionsList = document.getElementById('electionsList');
    electionsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <i class="fas fa-inbox"></i>
        </div>
        <h3>No Elections Available</h3>
        <p>There are currently no elections available for voting.</p>
        <button class="btn btn-primary" onclick="location.reload()">
          <i class="fas fa-sync-alt"></i>
          Refresh
        </button>
      </div>
    `;
  }

  getElectionStatus(election, now) {
    if (now < election.startTime) {
      return { type: 'upcoming', label: 'Upcoming' };
    } else if (now >= election.startTime && now < election.endTime) {
      return { type: 'active', label: 'Active' };
    } else {
      return { type: 'ended', label: 'Ended' };
    }
  }

  updateWalletInfo() {
    const walletManager = this.blockchainManager.getWalletManager();
    const account = walletManager.getFormattedAccount();
    
    const voterAddressElement = document.getElementById('voterAddress');
    if (voterAddressElement) {
      voterAddressElement.textContent = account;
    }
  }

  // Make component globally accessible for HTML onclick handlers
  makeGloballyAccessible() {
    window.voterComponent = this;
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new VoterComponent();
});

// Make confirmVote globally accessible for modal button
window.confirmVote = () => {
  if (window.voterComponent) {
    window.voterComponent.confirmVote();
  }
};
