// Embeddable Voting Widget
// Allows organizations to embed voting functionality in their websites

class VotingWidget {
  constructor(options = {}) {
    this.options = {
      container: options.container || '#voting-widget',
      organizationId: options.organizationId || '',
      apiUrl: options.apiUrl || 'http://localhost:3000/api/v1',
      theme: options.theme || 'light',
      width: options.width || '100%',
      height: options.height || 'auto',
      showHeader: options.showHeader !== false,
      showFooter: options.showFooter !== false,
      autoRefresh: options.autoRefresh !== false,
      refreshInterval: options.refreshInterval || 30000, // 30 seconds
      ...options
    };
    
    this.container = null;
    this.elections = [];
    this.selectedElection = null;
    this.selectedCandidate = null;
    this.refreshTimer = null;
  }

  async init() {
    try {
      this.container = document.querySelector(this.options.container);
      if (!this.container) {
        throw new Error(`Container ${this.options.container} not found`);
      }

      this.setupStyles();
      this.render();
      await this.loadElections();
      
      if (this.options.autoRefresh) {
        this.startAutoRefresh();
      }
    } catch (error) {
      console.error('VotingWidget initialization failed:', error);
      this.renderError('Failed to initialize voting widget');
    }
  }

  setupStyles() {
    const styleId = 'voting-widget-styles';
    if (document.getElementById(styleId)) return;

    const styles = `
      .voting-widget {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        background: ${this.options.theme === 'dark' ? '#1a1a1a' : '#ffffff'};
        color: ${this.options.theme === 'dark' ? '#ffffff' : '#333333'};
        width: ${this.options.width};
        height: ${this.options.height};
      }
      
      .widget-header {
        background: linear-gradient(135deg, #1e40af, #3b82f6);
        color: white;
        padding: 20px;
        text-align: center;
      }
      
      .widget-header h2 {
        margin: 0 0 8px 0;
        font-size: 1.5em;
      }
      
      .widget-header p {
        margin: 0;
        opacity: 0.9;
      }
      
      .widget-content {
        padding: 20px;
      }
      
      .election-card {
        border: 1px solid ${this.options.theme === 'dark' ? '#333' : '#e5e7eb'};
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        transition: all 0.2s ease;
      }
      
      .election-card:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transform: translateY(-1px);
      }
      
      .election-title {
        font-size: 1.2em;
        font-weight: 600;
        margin-bottom: 8px;
      }
      
      .election-status {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 0.8em;
        font-weight: 500;
        text-transform: uppercase;
      }
      
      .status-active {
        background: #dcfce7;
        color: #166534;
      }
      
      .status-upcoming {
        background: #fef3c7;
        color: #92400e;
      }
      
      .status-ended {
        background: #fee2e2;
        color: #991b1b;
      }
      
      .candidates-list {
        margin-top: 16px;
      }
      
      .candidate-option {
        display: flex;
        align-items: center;
        padding: 12px;
        border: 1px solid ${this.options.theme === 'dark' ? '#333' : '#e5e7eb'};
        border-radius: 6px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .candidate-option:hover {
        background: ${this.options.theme === 'dark' ? '#2a2a2a' : '#f9fafb'};
      }
      
      .candidate-option.selected {
        border-color: #3b82f6;
        background: #eff6ff;
      }
      
      .candidate-radio {
        margin-right: 12px;
      }
      
      .candidate-info h4 {
        margin: 0 0 4px 0;
        font-weight: 500;
      }
      
      .candidate-info p {
        margin: 0;
        font-size: 0.9em;
        opacity: 0.7;
      }
      
      .vote-button {
        background: #3b82f6;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s ease;
        margin-top: 16px;
      }
      
      .vote-button:hover {
        background: #2563eb;
      }
      
      .vote-button:disabled {
        background: #9ca3af;
        cursor: not-allowed;
      }
      
      .loading {
        text-align: center;
        padding: 40px;
      }
      
      .spinner {
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3b82f6;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .error-message {
        background: #fee2e2;
        color: #991b1b;
        padding: 16px;
        border-radius: 6px;
        text-align: center;
      }
      
      .success-message {
        background: #dcfce7;
        color: #166534;
        padding: 16px;
        border-radius: 6px;
        text-align: center;
      }
      
      .empty-state {
        text-align: center;
        padding: 40px;
        opacity: 0.7;
      }
      
      .widget-footer {
        padding: 16px;
        text-align: center;
        font-size: 0.8em;
        opacity: 0.7;
        border-top: 1px solid ${this.options.theme === 'dark' ? '#333' : '#e5e7eb'};
      }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.id = styleId;
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  render() {
    this.container.innerHTML = `
      <div class="voting-widget">
        ${this.options.showHeader ? this.renderHeader() : ''}
        <div class="widget-content">
          <div class="loading">
            <div class="spinner"></div>
            <p>Loading elections...</p>
          </div>
        </div>
        ${this.options.showFooter ? this.renderFooter() : ''}
      </div>
    `;
  }

  renderHeader() {
    return `
      <div class="widget-header">
        <h2>Secure Voting</h2>
        <p>Blockchain-powered elections</p>
      </div>
    `;
  }

  renderFooter() {
    return `
      <div class="widget-footer">
        Powered by Decentralized Voting System
      </div>
    `;
  }

  async loadElections() {
    try {
      const response = await fetch(`${this.options.apiUrl}/elections?status=active`, {
        headers: {
          'X-Organization-ID': this.options.organizationId,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.elections = data.success ? data.data.elections : [];
      this.renderElections();
    } catch (error) {
      console.error('Failed to load elections:', error);
      this.renderError('Failed to load elections. Please try again later.');
    }
  }

  renderElections() {
    const content = this.container.querySelector('.widget-content');
    
    if (this.elections.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <h3>No Active Elections</h3>
          <p>There are currently no active elections.</p>
          <p>Check back later for upcoming elections.</p>
        </div>
      `;
      return;
    }

    const electionsHtml = this.elections.map(election => this.renderElection(election)).join('');
    content.innerHTML = electionsHtml;

    // Add event listeners
    this.setupEventListeners();
  }

  renderElection(election) {
    const status = this.getElectionStatus(election);
    const statusClass = `status-${status}`;
    
    return `
      <div class="election-card" data-election-id="${election.id}">
        <div class="election-title">${election.name}</div>
        <div class="election-status ${statusClass}">${status}</div>
        ${election.description ? `<p>${election.description}</p>` : ''}
        
        ${status === 'active' ? this.renderCandidates(election) : ''}
        ${status === 'ended' ? this.renderResults(election) : ''}
      </div>
    `;
  }

  renderCandidates(election) {
    const candidatesHtml = election.candidates.map((candidate, index) => `
      <div class="candidate-option" data-candidate-id="${index}">
        <input type="radio" name="election-${election.id}" value="${index}" class="candidate-radio">
        <div class="candidate-info">
          <h4>${candidate.name}</h4>
          ${candidate.description ? `<p>${candidate.description}</p>` : ''}
        </div>
      </div>
    `).join('');

    return `
      <div class="candidates-list">
        <h4>Select your candidate:</h4>
        ${candidatesHtml}
        <button class="vote-button" data-election-id="${election.id}" disabled>
          Cast Vote
        </button>
      </div>
    `;
  }

  renderResults(election) {
    if (!election.results) return '<p>Results will be available after the election ends.</p>';
    
    const resultsHtml = election.results.candidates.map(candidate => `
      <div class="candidate-result">
        <strong>${candidate.name}</strong>: ${candidate.voteCount} votes (${candidate.percentage}%)
      </div>
    `).join('');

    return `
      <div class="election-results">
        <h4>Results:</h4>
        ${resultsHtml}
        <p><strong>Total Votes:</strong> ${election.results.totalVotes}</p>
      </div>
    `;
  }

  setupEventListeners() {
    // Candidate selection
    this.container.addEventListener('change', (e) => {
      if (e.target.type === 'radio') {
        const electionId = e.target.name.split('-')[1];
        const candidateId = parseInt(e.target.value);
        
        // Update UI
        const candidateOptions = this.container.querySelectorAll(`input[name="election-${electionId}"]`);
        candidateOptions.forEach(option => {
          option.closest('.candidate-option').classList.remove('selected');
        });
        e.target.closest('.candidate-option').classList.add('selected');
        
        // Enable vote button
        const voteButton = this.container.querySelector(`button[data-election-id="${electionId}"]`);
        if (voteButton) {
          voteButton.disabled = false;
        }
        
        this.selectedElection = electionId;
        this.selectedCandidate = candidateId;
      }
    });

    // Vote button clicks
    this.container.addEventListener('click', (e) => {
      if (e.target.classList.contains('vote-button')) {
        const electionId = e.target.dataset.electionId;
        this.castVote(electionId);
      }
    });
  }

  async castVote(electionId) {
    if (!this.selectedCandidate !== null || this.selectedElection !== electionId) {
      this.showMessage('Please select a candidate before voting.', 'error');
      return;
    }

    try {
      // In a real implementation, you would get the voter's wallet address
      // For demo purposes, we'll use a placeholder
      const voterAddress = '0x742d35Cc6634C0532925a3b8D4C2C7C9C4d5c3e1';
      
      const response = await fetch(`${this.options.apiUrl}/elections/${electionId}/vote`, {
        method: 'POST',
        headers: {
          'X-Organization-ID': this.options.organizationId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          candidateId: this.selectedCandidate,
          voterAddress: voterAddress
        })
      });

      const data = await response.json();
      
      if (data.success) {
        this.showMessage('Vote cast successfully! Transaction hash: ' + data.data.transactionHash.substring(0, 10) + '...', 'success');
        // Refresh elections to show updated state
        setTimeout(() => this.loadElections(), 2000);
      } else {
        this.showMessage(data.error || 'Failed to cast vote', 'error');
      }
    } catch (error) {
      console.error('Vote casting failed:', error);
      this.showMessage('Failed to cast vote. Please try again.', 'error');
    }
  }

  getElectionStatus(election) {
    const now = Math.floor(Date.now() / 1000);
    const startTime = new Date(election.startTime).getTime() / 1000;
    const endTime = new Date(election.endTime).getTime() / 1000;
    
    if (now < startTime) return 'upcoming';
    if (now > endTime) return 'ended';
    return 'active';
  }

  showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `${type}-message`;
    messageDiv.textContent = message;
    
    const content = this.container.querySelector('.widget-content');
    content.insertBefore(messageDiv, content.firstChild);
    
    // Remove message after 5 seconds
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.parentNode.removeChild(messageDiv);
      }
    }, 5000);
  }

  renderError(message) {
    const content = this.container.querySelector('.widget-content');
    content.innerHTML = `
      <div class="error-message">
        <h3>Error</h3>
        <p>${message}</p>
      </div>
    `;
  }

  startAutoRefresh() {
    this.refreshTimer = setInterval(() => {
      this.loadElections();
    }, this.options.refreshInterval);
  }

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  destroy() {
    this.stopAutoRefresh();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// Make it available globally
window.VotingWidget = VotingWidget;

// Auto-initialize if data attributes are present
document.addEventListener('DOMContentLoaded', () => {
  const autoInitElements = document.querySelectorAll('[data-voting-widget]');
  autoInitElements.forEach(element => {
    const options = {
      container: element,
      organizationId: element.dataset.organizationId,
      apiUrl: element.dataset.apiUrl,
      theme: element.dataset.theme || 'light'
    };
    
    const widget = new VotingWidget(options);
    widget.init();
  });
});
