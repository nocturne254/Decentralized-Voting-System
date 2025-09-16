/**
 * UI Enhancements and Quality-of-Life Improvements
 * Extends existing UI with modern interactions and accessibility features
 */

export interface UIEnhancementConfig {
  tenantId: string;
  features: {
    confirmationGracePeriod: boolean;
    voterReceipts: boolean;
    darkMode: boolean;
    searchAndFilter: boolean;
    progressiveDisclosure: boolean;
    offlineQueueing: boolean;
    sessionContinuity: boolean;
  };
  gracePeriodSeconds: number;
  autoSaveInterval: number;
}

export interface VoteConfirmation {
  voteId: string;
  candidateId: string;
  candidateName: string;
  timestamp: number;
  gracePeriodEnd: number;
  confirmed: boolean;
  undone: boolean;
}

export interface VoterReceipt {
  receiptId: string;
  electionId: string;
  voterHash: string;
  voteHash: string;
  timestamp: number;
  verificationUrl: string;
  qrCode?: string;
}

/**
 * UI Enhancement Manager
 * Integrates with existing UI to add modern interactions
 */
export class UIEnhancementManager {
  private config: UIEnhancementConfig;
  private pendingVotes: Map<string, VoteConfirmation> = new Map();
  private receipts: Map<string, VoterReceipt> = new Map();
  private savedSessions: Map<string, any> = new Map();
  private offlineQueue: any[] = [];

  constructor(config: UIEnhancementConfig) {
    this.config = config;
    this.initializeEnhancements();
  }

  /**
   * Initialize UI enhancements
   */
  private initializeEnhancements(): void {
    if (this.config.features.darkMode) {
      this.initializeDarkMode();
    }
    
    if (this.config.features.sessionContinuity) {
      this.initializeSessionContinuity();
    }
    
    if (this.config.features.offlineQueueing) {
      this.initializeOfflineQueueing();
    }

    this.initializeProgressiveDisclosure();
    this.initializeSearchAndFilter();
    this.initializeAccessibilityEnhancements();
  }

  /**
   * Handle vote confirmation with grace period
   * @param voteData Vote data from existing system
   */
  async handleVoteWithGracePeriod(voteData: {
    candidateId: string;
    candidateName: string;
    voterHash: string;
    encryptedVote: string;
  }): Promise<VoteConfirmation> {
    if (!this.config.features.confirmationGracePeriod) {
      // Skip grace period, process immediately
      return this.processVoteImmediately(voteData);
    }

    const voteId = `vote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const gracePeriodEnd = Date.now() + (this.config.gracePeriodSeconds * 1000);

    const confirmation: VoteConfirmation = {
      voteId,
      candidateId: voteData.candidateId,
      candidateName: voteData.candidateName,
      timestamp: Date.now(),
      gracePeriodEnd,
      confirmed: false,
      undone: false
    };

    this.pendingVotes.set(voteId, confirmation);

    // Show confirmation UI
    this.showVoteConfirmationUI(confirmation, voteData);

    // Auto-confirm after grace period
    setTimeout(() => {
      this.autoConfirmVote(voteId, voteData);
    }, this.config.gracePeriodSeconds * 1000);

    return confirmation;
  }

  /**
   * Undo vote during grace period
   * @param voteId Vote ID
   */
  undoVote(voteId: string): boolean {
    const confirmation = this.pendingVotes.get(voteId);
    if (!confirmation || confirmation.confirmed || confirmation.undone) {
      return false;
    }

    if (Date.now() > confirmation.gracePeriodEnd) {
      return false; // Grace period expired
    }

    confirmation.undone = true;
    this.pendingVotes.set(voteId, confirmation);
    
    this.hideVoteConfirmationUI(voteId);
    this.showUndoSuccessMessage();
    
    return true;
  }

  /**
   * Generate voter receipt
   * @param voteData Vote data
   */
  async generateVoterReceipt(voteData: {
    electionId: string;
    voterHash: string;
    voteHash: string;
  }): Promise<VoterReceipt> {
    const receiptId = `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const verificationUrl = `/verify-receipt?id=${receiptId}`;

    const receipt: VoterReceipt = {
      receiptId,
      electionId: voteData.electionId,
      voterHash: voteData.voterHash,
      voteHash: voteData.voteHash,
      timestamp: Date.now(),
      verificationUrl
    };

    // Generate QR code for easy verification
    if (typeof window !== 'undefined') {
      receipt.qrCode = await this.generateQRCode(verificationUrl);
    }

    this.receipts.set(receiptId, receipt);
    
    // Show receipt UI
    this.showReceiptUI(receipt);
    
    return receipt;
  }

  /**
   * Initialize dark mode support
   */
  private initializeDarkMode(): void {
    // Check user preference
    const savedTheme = localStorage.getItem('voting-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    this.applyTheme(theme);

    // Add theme toggle
    this.addThemeToggle();
  }

  /**
   * Apply theme to existing UI
   * @param theme Theme name
   */
  private applyTheme(theme: 'light' | 'dark'): void {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('voting-theme', theme);

    // Add CSS custom properties for theme
    const root = document.documentElement;
    if (theme === 'dark') {
      root.style.setProperty('--bg-primary', '#1a1a1a');
      root.style.setProperty('--bg-secondary', '#2d2d2d');
      root.style.setProperty('--text-primary', '#ffffff');
      root.style.setProperty('--text-secondary', '#cccccc');
      root.style.setProperty('--border-color', '#404040');
    } else {
      root.style.setProperty('--bg-primary', '#ffffff');
      root.style.setProperty('--bg-secondary', '#f8f9fa');
      root.style.setProperty('--text-primary', '#212529');
      root.style.setProperty('--text-secondary', '#6c757d');
      root.style.setProperty('--border-color', '#dee2e6');
    }
  }

  /**
   * Add theme toggle button to existing UI
   */
  private addThemeToggle(): void {
    const toggle = document.createElement('button');
    toggle.className = 'theme-toggle';
    toggle.innerHTML = '🌓';
    toggle.setAttribute('aria-label', 'Toggle dark mode');
    toggle.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 50%;
      width: 40px;
      height: 40px;
      cursor: pointer;
      font-size: 18px;
    `;

    toggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      this.applyTheme(newTheme);
    });

    document.body.appendChild(toggle);
  }

  /**
   * Initialize session continuity
   */
  private initializeSessionContinuity(): void {
    // Auto-save form data
    setInterval(() => {
      this.saveCurrentSession();
    }, this.config.autoSaveInterval);

    // Restore session on page load
    window.addEventListener('load', () => {
      this.restoreSession();
    });

    // Save before page unload
    window.addEventListener('beforeunload', () => {
      this.saveCurrentSession();
    });
  }

  /**
   * Save current session state
   */
  private saveCurrentSession(): void {
    const sessionData = {
      timestamp: Date.now(),
      formData: this.collectFormData(),
      scrollPosition: window.scrollY,
      selectedCandidate: this.getSelectedCandidate()
    };

    const sessionKey = `voting_session_${this.config.tenantId}`;
    localStorage.setItem(sessionKey, JSON.stringify(sessionData));
  }

  /**
   * Restore previous session
   */
  private restoreSession(): void {
    const sessionKey = `voting_session_${this.config.tenantId}`;
    const savedSession = localStorage.getItem(sessionKey);
    
    if (!savedSession) return;

    try {
      const sessionData = JSON.parse(savedSession);
      
      // Check if session is recent (within 1 hour)
      if (Date.now() - sessionData.timestamp > 60 * 60 * 1000) {
        localStorage.removeItem(sessionKey);
        return;
      }

      // Restore form data
      this.restoreFormData(sessionData.formData);
      
      // Restore scroll position
      setTimeout(() => {
        window.scrollTo(0, sessionData.scrollPosition);
      }, 100);

      // Show restoration notification
      this.showSessionRestoredNotification();
      
    } catch (error) {
      console.error('Failed to restore session:', error);
      localStorage.removeItem(sessionKey);
    }
  }

  /**
   * Initialize progressive disclosure for candidate cards
   */
  private initializeProgressiveDisclosure(): void {
    // Enhance existing candidate cards with expand/collapse
    document.addEventListener('DOMContentLoaded', () => {
      this.enhanceCandidateCards();
    });
  }

  /**
   * Enhance existing candidate cards with progressive disclosure
   */
  private enhanceCandidateCards(): void {
    const candidateCards = document.querySelectorAll('.candidate-card, .candidate-option');
    
    candidateCards.forEach((card, index) => {
      // Add manifesto toggle if not exists
      if (!card.querySelector('.manifesto-toggle')) {
        const manifestoToggle = document.createElement('button');
        manifestoToggle.className = 'manifesto-toggle';
        manifestoToggle.textContent = 'Read manifesto';
        manifestoToggle.setAttribute('aria-expanded', 'false');
        manifestoToggle.setAttribute('aria-controls', `manifesto-${index}`);
        
        // Create manifesto content area
        const manifestoContent = document.createElement('div');
        manifestoContent.className = 'manifesto-content';
        manifestoContent.id = `manifesto-${index}`;
        manifestoContent.style.display = 'none';
        manifestoContent.innerHTML = '<p>Loading manifesto...</p>';
        
        manifestoToggle.addEventListener('click', () => {
          this.toggleManifesto(manifestoToggle, manifestoContent);
        });
        
        card.appendChild(manifestoToggle);
        card.appendChild(manifestoContent);
      }
    });
  }

  /**
   * Toggle manifesto display
   */
  private toggleManifesto(toggle: HTMLButtonElement, content: HTMLElement): void {
    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    
    if (isExpanded) {
      content.style.display = 'none';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = 'Read manifesto';
    } else {
      content.style.display = 'block';
      toggle.setAttribute('aria-expanded', 'true');
      toggle.textContent = 'Close manifesto';
      
      // Load manifesto content if not loaded
      if (content.innerHTML === '<p>Loading manifesto...</p>') {
        this.loadManifestoContent(content, toggle);
      }
    }
  }

  /**
   * Initialize search and filter functionality
   */
  private initializeSearchAndFilter(): void {
    if (!this.config.features.searchAndFilter) return;

    // Add search bar to existing ballot
    const ballot = document.querySelector('.ballot, .voting-interface');
    if (ballot && !ballot.querySelector('.candidate-search')) {
      this.addSearchAndFilterUI(ballot as HTMLElement);
    }
  }

  /**
   * Add search and filter UI to ballot
   */
  private addSearchAndFilterUI(ballot: HTMLElement): void {
    const searchContainer = document.createElement('div');
    searchContainer.className = 'candidate-search-container';
    searchContainer.innerHTML = `
      <div class="search-filters">
        <input type="text" class="candidate-search" placeholder="Search candidates..." aria-label="Search candidates">
        <select class="candidate-filter" aria-label="Filter by category">
          <option value="">All candidates</option>
          <option value="party-a">Party A</option>
          <option value="party-b">Party B</option>
          <option value="independent">Independent</option>
        </select>
        <button class="clear-filters" aria-label="Clear all filters">Clear</button>
      </div>
    `;

    ballot.insertBefore(searchContainer, ballot.firstChild);

    // Add event listeners
    const searchInput = searchContainer.querySelector('.candidate-search') as HTMLInputElement;
    const filterSelect = searchContainer.querySelector('.candidate-filter') as HTMLSelectElement;
    const clearButton = searchContainer.querySelector('.clear-filters') as HTMLButtonElement;

    searchInput.addEventListener('input', () => this.filterCandidates());
    filterSelect.addEventListener('change', () => this.filterCandidates());
    clearButton.addEventListener('click', () => this.clearFilters());
  }

  /**
   * Filter candidates based on search and filter criteria
   */
  private filterCandidates(): void {
    const searchTerm = (document.querySelector('.candidate-search') as HTMLInputElement)?.value.toLowerCase() || '';
    const filterValue = (document.querySelector('.candidate-filter') as HTMLSelectElement)?.value || '';
    
    const candidates = document.querySelectorAll('.candidate-card, .candidate-option');
    
    candidates.forEach(candidate => {
      const name = candidate.querySelector('.candidate-name')?.textContent?.toLowerCase() || '';
      const party = candidate.getAttribute('data-party') || '';
      
      const matchesSearch = !searchTerm || name.includes(searchTerm);
      const matchesFilter = !filterValue || party === filterValue;
      
      if (matchesSearch && matchesFilter) {
        (candidate as HTMLElement).style.display = '';
      } else {
        (candidate as HTMLElement).style.display = 'none';
      }
    });
  }

  /**
   * Initialize offline queueing
   */
  private initializeOfflineQueueing(): void {
    if (!this.config.features.offlineQueueing) return;

    // Monitor online/offline status
    window.addEventListener('online', () => this.processOfflineQueue());
    window.addEventListener('offline', () => this.showOfflineNotification());
  }

  /**
   * Initialize accessibility enhancements
   */
  private initializeAccessibilityEnhancements(): void {
    // Add keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      this.handleKeyboardShortcuts(event);
    });

    // Enhance focus management
    this.enhanceFocusManagement();

    // Add screen reader announcements
    this.setupScreenReaderAnnouncements();
  }

  // UI Helper Methods

  private showVoteConfirmationUI(confirmation: VoteConfirmation, voteData: any): void {
    const modal = document.createElement('div');
    modal.className = 'vote-confirmation-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Confirm Your Vote</h3>
        <p>You are voting for: <strong>${confirmation.candidateName}</strong></p>
        <p>You have ${this.config.gracePeriodSeconds} seconds to undo this vote.</p>
        <div class="countdown" id="countdown-${confirmation.voteId}"></div>
        <div class="modal-actions">
          <button class="btn-undo" onclick="window.uiEnhancer.undoVote('${confirmation.voteId}')">
            Undo Vote
          </button>
          <button class="btn-confirm" onclick="window.uiEnhancer.confirmVote('${confirmation.voteId}')">
            Confirm Now
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    
    // Start countdown
    this.startCountdown(confirmation.voteId, confirmation.gracePeriodEnd);
  }

  private showReceiptUI(receipt: VoterReceipt): void {
    const modal = document.createElement('div');
    modal.className = 'receipt-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Vote Receipt</h3>
        <p>Your vote has been recorded successfully.</p>
        <div class="receipt-details">
          <p><strong>Receipt ID:</strong> ${receipt.receiptId}</p>
          <p><strong>Timestamp:</strong> ${new Date(receipt.timestamp).toLocaleString()}</p>
          <p><strong>Verification:</strong> <a href="${receipt.verificationUrl}" target="_blank">Verify Receipt</a></p>
        </div>
        ${receipt.qrCode ? `<div class="qr-code">${receipt.qrCode}</div>` : ''}
        <button class="btn-close" onclick="this.closest('.receipt-modal').remove()">Close</button>
      </div>
    `;

    document.body.appendChild(modal);
  }

  private async processVoteImmediately(voteData: any): Promise<VoteConfirmation> {
    // Integrate with existing voting system
    const voteId = `vote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      voteId,
      candidateId: voteData.candidateId,
      candidateName: voteData.candidateName,
      timestamp: Date.now(),
      gracePeriodEnd: Date.now(),
      confirmed: true,
      undone: false
    };
  }

  private autoConfirmVote(voteId: string, voteData: any): void {
    const confirmation = this.pendingVotes.get(voteId);
    if (!confirmation || confirmation.undone) return;

    confirmation.confirmed = true;
    this.pendingVotes.set(voteId, confirmation);
    
    // Process vote with existing system
    this.processVoteWithExistingSystem(voteData);
    
    this.hideVoteConfirmationUI(voteId);
  }

  private processVoteWithExistingSystem(voteData: any): void {
    // This would integrate with the existing blockchain voting system
    console.log('Processing vote with existing system:', voteData);
  }

  private startCountdown(voteId: string, endTime: number): void {
    const countdownElement = document.getElementById(`countdown-${voteId}`);
    if (!countdownElement) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, endTime - Date.now());
      const seconds = Math.ceil(remaining / 1000);
      
      countdownElement.textContent = `${seconds} seconds remaining`;
      
      if (remaining <= 0) {
        clearInterval(interval);
        countdownElement.textContent = 'Vote confirmed';
      }
    }, 100);
  }

  private hideVoteConfirmationUI(voteId: string): void {
    const modal = document.querySelector('.vote-confirmation-modal');
    if (modal) {
      modal.remove();
    }
  }

  private showUndoSuccessMessage(): void {
    const message = document.createElement('div');
    message.className = 'success-message';
    message.textContent = 'Vote successfully undone. You can vote again.';
    document.body.appendChild(message);
    
    setTimeout(() => message.remove(), 3000);
  }

  private collectFormData(): any {
    const formData: any = {};
    const inputs = document.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      const element = input as HTMLInputElement;
      if (element.name) {
        formData[element.name] = element.value;
      }
    });
    
    return formData;
  }

  private restoreFormData(formData: any): void {
    Object.keys(formData).forEach(name => {
      const element = document.querySelector(`[name="${name}"]`) as HTMLInputElement;
      if (element) {
        element.value = formData[name];
      }
    });
  }

  private getSelectedCandidate(): string | null {
    const selected = document.querySelector('input[type="radio"]:checked') as HTMLInputElement;
    return selected ? selected.value : null;
  }

  private showSessionRestoredNotification(): void {
    const notification = document.createElement('div');
    notification.className = 'session-restored-notification';
    notification.textContent = 'Your previous session has been restored.';
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 5000);
  }

  private async loadManifestoContent(content: HTMLElement, toggle: HTMLButtonElement): void {
    // This would integrate with the candidate enhancement system
    const candidateId = toggle.closest('.candidate-card, .candidate-option')?.getAttribute('data-candidate-id');
    
    try {
      // Simulate loading manifesto
      await new Promise(resolve => setTimeout(resolve, 500));
      
      content.innerHTML = `
        <div class="manifesto-content">
          <h4>Candidate Manifesto</h4>
          <p>This is where the candidate's manifesto would be displayed...</p>
          <div class="pledges">
            <h5>Key Pledges:</h5>
            <ul>
              <li>Improve campus facilities</li>
              <li>Enhance student services</li>
              <li>Increase transparency</li>
            </ul>
          </div>
        </div>
      `;
    } catch (error) {
      content.innerHTML = '<p>Failed to load manifesto. Please try again.</p>';
    }
  }

  private clearFilters(): void {
    const searchInput = document.querySelector('.candidate-search') as HTMLInputElement;
    const filterSelect = document.querySelector('.candidate-filter') as HTMLSelectElement;
    
    if (searchInput) searchInput.value = '';
    if (filterSelect) filterSelect.value = '';
    
    this.filterCandidates();
  }

  private processOfflineQueue(): void {
    if (this.offlineQueue.length === 0) return;
    
    console.log(`Processing ${this.offlineQueue.length} queued actions...`);
    
    // Process queued actions
    this.offlineQueue.forEach(action => {
      // Process with existing system
      this.processVoteWithExistingSystem(action);
    });
    
    this.offlineQueue = [];
    this.showOnlineNotification();
  }

  private showOfflineNotification(): void {
    const notification = document.createElement('div');
    notification.className = 'offline-notification';
    notification.textContent = 'You are offline. Votes will be queued and submitted when connection is restored.';
    document.body.appendChild(notification);
  }

  private showOnlineNotification(): void {
    const notification = document.createElement('div');
    notification.className = 'online-notification';
    notification.textContent = 'Connection restored. Queued votes have been submitted.';
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
  }

  private handleKeyboardShortcuts(event: KeyboardEvent): void {
    // Integrate with existing accessibility system
    if (event.altKey) {
      switch (event.key.toLowerCase()) {
        case 'v':
          event.preventDefault();
          this.focusVoteButton();
          break;
        case 's':
          event.preventDefault();
          this.focusSearch();
          break;
        case 't':
          event.preventDefault();
          this.toggleTheme();
          break;
      }
    }
  }

  private enhanceFocusManagement(): void {
    // Add focus indicators
    const style = document.createElement('style');
    style.textContent = `
      .enhanced-focus:focus {
        outline: 3px solid #4A90E2;
        outline-offset: 2px;
        box-shadow: 0 0 0 1px rgba(74, 144, 226, 0.3);
      }
    `;
    document.head.appendChild(style);
    
    // Add focus class to interactive elements
    document.querySelectorAll('button, input, select, a').forEach(element => {
      element.classList.add('enhanced-focus');
    });
  }

  private setupScreenReaderAnnouncements(): void {
    // Create announcement region
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.style.cssText = `
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    `;
    document.body.appendChild(announcer);
    
    // Store reference for announcements
    (window as any).screenReaderAnnouncer = announcer;
  }

  private focusVoteButton(): void {
    const voteButton = document.querySelector('.vote-button, .btn-vote') as HTMLElement;
    if (voteButton) {
      voteButton.focus();
    }
  }

  private focusSearch(): void {
    const searchInput = document.querySelector('.candidate-search') as HTMLElement;
    if (searchInput) {
      searchInput.focus();
    }
  }

  private toggleTheme(): void {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
  }

  private async generateQRCode(url: string): Promise<string> {
    // This would integrate with a QR code library
    // For now, return placeholder
    return `<div class="qr-placeholder">QR Code for: ${url}</div>`;
  }
}

// Make available globally for integration
declare global {
  interface Window {
    uiEnhancer: UIEnhancementManager;
    screenReaderAnnouncer: HTMLElement;
  }
}
