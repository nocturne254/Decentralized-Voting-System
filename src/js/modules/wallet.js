// Wallet Management Module
export class WalletManager {
  constructor() {
    this.account = null;
    this.isConnected = false;
    this.callbacks = {
      onConnect: [],
      onDisconnect: [],
      onAccountChange: []
    };
  }

  // Initialize wallet connection
  async init() {
    if (!this.isMetaMaskAvailable()) {
      throw new Error('MetaMask not detected. Please install MetaMask extension.');
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        this.account = accounts[0];
        this.isConnected = true;
        this.setupEventListeners();
        this.triggerCallbacks('onConnect', this.account);
      }
    } catch (error) {
      console.error('Failed to initialize wallet:', error);
      throw error;
    }
  }

  // Connect to MetaMask
  async connect() {
    if (!this.isMetaMaskAvailable()) {
      throw new Error('MetaMask not detected');
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) {
        this.account = accounts[0];
        this.isConnected = true;
        this.setupEventListeners();
        this.triggerCallbacks('onConnect', this.account);
        return this.account;
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }

  // Switch account
  async switchAccount() {
    if (!this.isMetaMaskAvailable()) {
      throw new Error('MetaMask not detected');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }]
      });
    } catch (error) {
      console.error('Failed to switch account:', error);
      throw error;
    }
  }

  // Get current account
  getAccount() {
    return this.account;
  }

  // Get formatted account address
  getFormattedAccount() {
    if (!this.account) return 'Not connected';
    return `${this.account.substring(0, 6)}...${this.account.substring(38)}`;
  }

  // Check if MetaMask is available
  isMetaMaskAvailable() {
    return typeof window.ethereum !== 'undefined';
  }

  // Setup event listeners for account changes
  setupEventListeners() {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          const newAccount = accounts[0];
          if (newAccount !== this.account) {
            this.account = newAccount;
            this.triggerCallbacks('onAccountChange', newAccount);
          }
        } else {
          this.disconnect();
        }
      });

      window.ethereum.on('disconnect', () => {
        this.disconnect();
      });
    }
  }

  // Disconnect wallet
  disconnect() {
    this.account = null;
    this.isConnected = false;
    this.triggerCallbacks('onDisconnect');
  }

  // Add event callback
  on(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback);
    }
  }

  // Remove event callback
  off(event, callback) {
    if (this.callbacks[event]) {
      const index = this.callbacks[event].indexOf(callback);
      if (index > -1) {
        this.callbacks[event].splice(index, 1);
      }
    }
  }

  // Trigger callbacks
  triggerCallbacks(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => callback(data));
    }
  }
}
