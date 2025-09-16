// Main Application Entry Point
import { AuthManager } from './modules/auth.js';
import { BlockchainManager } from './modules/blockchain.js';
import { UIManager } from './modules/ui.js';
import { WalletManager } from './modules/wallet.js';

class VotingApp {
  constructor() {
    this.authManager = new AuthManager();
    this.blockchainManager = new BlockchainManager();
    this.uiManager = new UIManager();
    this.walletManager = new WalletManager();
    this.init();
  }

  async init() {
    try {
      // Check if user is authenticated
      if (this.authManager.isAuthenticated()) {
        // Verify token is still valid
        const isValid = await this.authManager.verifyToken();
        if (!isValid) {
          this.authManager.logout();
          this.redirectToLogin();
          return;
        }

        // Initialize blockchain connection
        await this.blockchainManager.init();
        
        // Redirect to appropriate dashboard
        this.authManager.redirectToRolePage();
      } else {
        this.redirectToLogin();
      }
    } catch (error) {
      console.error('App initialization failed:', error);
      this.uiManager.showNotification('Failed to initialize application', 'error');
    }
  }

  redirectToLogin() {
    if (!window.location.pathname.includes('login-modern.html')) {
      window.location.href = 'login-modern.html';
    }
  }

  // Global utility methods
  static formatAddress(address) {
    if (!address) return 'Not connected';
    return `${address.substring(0, 6)}...${address.substring(38)}`;
  }

  static formatDate(timestamp, format = 'short') {
    const date = new Date(timestamp);
    if (format === 'long') {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.votingApp = new VotingApp();
});

// Export for use in other modules
export { VotingApp };
