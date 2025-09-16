// Admin Dashboard Component - Modernized with ES2022+ features
import { BlockchainManager } from '../modules/blockchain.js';
import { UIManager } from '../modules/ui.js';
import { AuthManager } from '../modules/auth.js';
import { logger } from '../utils/logger.ts';

class AdminComponent {
  constructor() {
    this.authManager = new AuthManager();
    this.blockchainManager = new BlockchainManager();
    this.uiManager = new UIManager();
    this.candidateCounter = 1;
    this.init();
  }

  async init() {
    // Check authentication
    if (!this.authManager.isAuthenticated() || !this.authManager.isAdmin()) {
      window.location.href = 'login-modern.html';
      return;
    }

    try {
      // Initialize blockchain
      await this.blockchainManager.init();
      this.setupEventListeners();
      this.updateWalletInfo();
      this.loadElections();
      this.loadStatistics();
      this.makeGloballyAccessible();
    } catch (error) {
      logger.error('Admin initialization failed', 'ADMIN', { error: error.message });
      this.uiManager.showNotification('Failed to connect to blockchain', 'error');
    }
  }

  setupEventListeners() {
    // Election form submission
    const electionForm = document.getElementById('electionForm');
    if (electionForm) {
      electionForm.addEventListener('submit', (e) => this.handleCreateElection(e));
    }

    // Add candidate button
    const addCandidateBtn = document.querySelector('[onclick="addCandidate()"]');
    if (addCandidateBtn) {
      addCandidateBtn.onclick = () => this.addCandidate();
    }

    // Wallet events
    const walletManager = this.blockchainManager.getWalletManager();
    walletManager.on('onAccountChange', async (_account) => {
      this.updateWalletInfo();
      this.uiManager.showNotification('Account changed', 'info');
    });

    // Switch account button
    const switchBtn = document.querySelector('[onclick="switchAccount()"]');
    if (switchBtn) {
      switchBtn.onclick = () => this.switchAccount();
    }

    // Refresh elections button
    const refreshBtn = document.querySelector('[onclick="refreshElections()"]');
    if (refreshBtn) {
      refreshBtn.onclick = () => this.loadElections();
    }
  }

  async handleCreateElection(event) {
    event.preventDefault();

    const electionName = document.getElementById('electionName').value.trim();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    // Validate form
    const validation = this.uiManager.validateForm(event.target);
    if (!validation.isValid) {
      this.uiManager.showNotification(validation.errors[0], 'error');
      return;
    }

    // Collect candidates
    const candidates = this.collectCandidates();
    if (candidates.length < 2) {
      this.uiManager.showNotification('Please add at least 2 candidates', 'error');
      return;
    }

    try {
      // Convert dates to timestamps
      const startTime = Math.floor(new Date(startDate).getTime() / 1000);
      const endTime = Math.floor(new Date(endDate).getTime() / 1000);

      // Show loading
      const createBtn = document.getElementById('createElection');
      createBtn.classList.add('loading');
      createBtn.disabled = true;

      // Create election on blockchain
      await this.blockchainManager.createElection(
        electionName,
        startTime,
        endTime,
        candidates
      );

      logger.info('Election created successfully', 'ADMIN');
      this.uiManager.showNotification(
        `Election "${electionName}" created successfully!`,
        'success'
      );

      // Reset form
      event.target.reset();
      this.resetCandidatesList();
      
      // Reload elections and statistics
      this.loadElections();
      this.loadStatistics();

    } catch (error) {
      console.error('Failed to create election:', error);
      this.uiManager.showNotification('Failed to create election', 'error');
    } finally {
      const createBtn = document.getElementById('createElection');
      createBtn.classList.remove('loading');
      createBtn.disabled = false;
    }
  }

  collectCandidates() {
    const candidates = [];
    const candidateEntries = document.querySelectorAll('.candidate-item');

    candidateEntries.forEach((entry) => {
      const nameInput = entry.querySelector('input[id^="candidateName"]');
      const partyInput = entry.querySelector('input[id^="candidateParty"]');

      if (nameInput && partyInput && nameInput.value.trim() && partyInput.value.trim()) {
        candidates.push({
          name: nameInput.value.trim(),
          party: partyInput.value.trim()
        });
      }
    });

    return candidates;
  }

  addCandidate() {
    this.candidateCounter++;
    const candidatesList = document.getElementById('candidatesList');
    
    const candidateItem = document.createElement('div');
    candidateItem.className = 'candidate-item';
    candidateItem.innerHTML = `
      <div class="candidate-info">
        <input type="text" class="input mb-2" placeholder="Candidate Name" id="candidateName${this.candidateCounter}" required>
        <input type="text" class="input" placeholder="Party/Position" id="candidateParty${this.candidateCounter}" required>
      </div>
      <button type="button" class="btn btn-error btn-sm" onclick="this.closest('.candidate-item').remove()">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    candidatesList.appendChild(candidateItem);
  }

  resetCandidatesList() {
    const candidatesList = document.getElementById('candidatesList');
    candidatesList.innerHTML = `
      <div class="candidate-item">
        <div class="candidate-info">
          <input type="text" class="input mb-2" placeholder="Candidate Name" id="candidateName1" required>
          <input type="text" class="input" placeholder="Party/Position" id="candidateParty1" required>
        </div>
      </div>
    `;
    this.candidateCounter = 1;
  }

  async loadElections() {
    const electionsList = document.getElementById('electionsList');
    this.uiManager.showLoading(electionsList, 'Loading elections...');

    try {
      const elections = await this.blockchainManager.getAllElections();
      
      if (elections.length === 0) {
        electionsList.innerHTML = `
          <div class="text-center py-8 text-secondary-500">
            <i class="fas fa-inbox text-5xl mb-4 opacity-50"></i>
            <p>No elections found</p>
          </div>
        `;
        return;
      }

      const electionsHTML = elections.map(election => this.renderElectionCard(election)).join('');
      electionsList.innerHTML = electionsHTML;

    } catch (error) {
      console.error('Failed to load elections:', error);
      electionsList.innerHTML = `
        <div class="text-center py-8 text-error-600">
          <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
          <p>Failed to load elections</p>
        </div>
      `;
    }
  }

  renderElectionCard(election) {
    const now = Math.floor(Date.now() / 1000);
    const status = this.getElectionStatus(election, now);
    const totalVotes = election.candidates.reduce((sum, candidate) => sum + candidate.voteCount, 0);

    return `
      <div class="election-card">
        <div class="election-header">
          <h3 class="election-title">${election.name}</h3>
          <span class="election-status status-${status.type}">${status.label}</span>
        </div>
        <div class="election-dates">
          <i class="fas fa-calendar"></i>
          ${this.uiManager.formatDate(election.startTime * 1000)} - ${this.uiManager.formatDate(election.endTime * 1000)}
        </div>
        <div class="election-stats">
          <div class="stat-item">
            <i class="fas fa-users"></i>
            <span>${election.candidates.length} Candidates</span>
          </div>
          <div class="stat-item">
            <i class="fas fa-vote-yea"></i>
            <span>${totalVotes} Votes</span>
          </div>
        </div>
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

  async loadStatistics() {
    try {
      const elections = await this.blockchainManager.getAllElections();
      
      const totalElections = elections.length;
      const activeElections = elections.filter(e => {
        const now = Math.floor(Date.now() / 1000);
        return now >= e.startTime && now < e.endTime;
      }).length;
      
      const totalVotes = elections.reduce((sum, election) => {
        return sum + election.candidates.reduce((voteSum, candidate) => voteSum + candidate.voteCount, 0);
      }, 0);
      
      const totalCandidates = elections.reduce((sum, election) => sum + election.candidates.length, 0);

      // Update statistics display
      document.getElementById('totalElections').textContent = totalElections;
      document.getElementById('activeElections').textContent = activeElections;
      document.getElementById('totalVotes').textContent = totalVotes;
      document.getElementById('totalCandidates').textContent = totalCandidates;

    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  }

  updateWalletInfo() {
    const walletManager = this.blockchainManager.getWalletManager();
    const account = walletManager.getFormattedAccount();
    
    const walletAddressElement = document.getElementById('walletAddress');
    if (walletAddressElement) {
      walletAddressElement.textContent = account;
    }
  }

  // Make component globally accessible for HTML onclick handlers
  makeGloballyAccessible() {
    window.adminComponent = this;
  }

  async switchAccount() {
    try {
      const walletManager = this.blockchainManager.getWalletManager();
      await walletManager.switchAccount();
    } catch (error) {
      console.error('Failed to switch account:', error);
      this.uiManager.showNotification('Failed to switch account', 'error');
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AdminComponent();
});
