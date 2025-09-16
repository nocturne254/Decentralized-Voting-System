// Authentication Module - Modernized with ES2022+ features
import { logger } from '../utils/logger.ts';
import { ErrorHandler } from '../utils/errorHandler.ts';
import { Validator } from '../utils/validation.ts';

export class AuthManager {
  // Private fields using ES2022 syntax
  #token = null;
  #user = null;
  #apiBase = (typeof window !== 'undefined' && window.location?.hostname) ? 
    `http://${window.location.hostname}:8888` : 'http://127.0.0.1:8888';
  #refreshTimer = null;
  #tokenExpiryTime = null;

  constructor() {
    this.#token = localStorage.getItem('voting_token');
    this.#loadUserFromStorage();
    this.#setupTokenRefresh();
    
    logger.info('AuthManager initialized', 'AUTH');
  }

  // Private method to load user from storage
  #loadUserFromStorage() {
    try {
      const userData = localStorage.getItem('voting_user');
      if (userData) {
        this.#user = JSON.parse(userData);
      }
    } catch (error) {
      logger.error('Failed to load user from storage', 'AUTH', error);
      this.#clearStorage();
    }
  }

  // Private method to setup token refresh
  #setupTokenRefresh() {
    const expiryTime = localStorage.getItem('token_expiry');
    if (expiryTime) {
      this.#tokenExpiryTime = parseInt(expiryTime);
      this.#scheduleTokenRefresh();
    }
  }

  // Private method to schedule token refresh
  #scheduleTokenRefresh() {
    if (this.#refreshTimer) {
      clearTimeout(this.#refreshTimer);
    }

    if (!this.#tokenExpiryTime) return;

    const now = Date.now();
    const timeUntilRefresh = this.#tokenExpiryTime - now - (5 * 60 * 1000); // Refresh 5 minutes before expiry

    if (timeUntilRefresh > 0) {
      this.#refreshTimer = setTimeout(() => {
        this.refreshToken().catch(error => {
          logger.error('Automatic token refresh failed', 'AUTH', error);
          this.logout();
        });
      }, timeUntilRefresh);
    }
  }

  // Private method to clear storage
  #clearStorage() {
    localStorage.removeItem('voting_token');
    localStorage.removeItem('voting_user');
    localStorage.removeItem('token_expiry');
  }

  // Login user with modern async/await and comprehensive error handling
  async login(voterId, password) {
    const startTime = performance.now();
    
    try {
      // Validate inputs
      if (!Validator.required(voterId) || !Validator.required(password)) {
        throw new Error('Voter ID and password are required');
      }

      logger.info('Attempting login', 'AUTH', { voterId });

      const response = await ErrorHandler.withRetry(
        () => fetch(`${this.#apiBase}/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            voter_id: voterId,
            password: password
          })
        }),
        { maxRetries: 2, delay: 1000 }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Invalid credentials');
      }

      const data = await response.json();
      
      // Store token and user data using private fields
      this.#token = data.token;
      this.#user = {
        id: voterId,
        role: data.role,
        name: data.name || voterId,
        loginTime: Date.now()
      };

      // Calculate token expiry (default 24 hours if not provided)
      const expiryTime = data.expiresIn ? 
        Date.now() + (data.expiresIn * 1000) : 
        Date.now() + (24 * 60 * 60 * 1000);
      
      this.#tokenExpiryTime = expiryTime;

      // Store in localStorage
      localStorage.setItem('voting_token', this.#token);
      localStorage.setItem('voting_user', JSON.stringify(this.#user));
      localStorage.setItem('token_expiry', expiryTime.toString());

      // Setup token refresh
      this.#scheduleTokenRefresh();

      const duration = performance.now() - startTime;
      logger.info('Login successful', 'AUTH', { 
        voterId, 
        role: this.#user.role, 
        duration: `${duration.toFixed(2)}ms` 
      });

      return {
        success: true,
        user: { ...this.#user },
        token: this.#token
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('Login failed', 'AUTH', { 
        voterId, 
        error: error.message, 
        duration: `${duration.toFixed(2)}ms` 
      });
      
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  // Refresh token
  async refreshToken() {
    if (!this.#token) {
      throw new Error('No token to refresh');
    }

    try {
      logger.info('Refreshing token', 'AUTH');

      const response = await fetch(`${this.#apiBase}/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.#token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      this.#token = data.token;
      
      const expiryTime = data.expiresIn ? 
        Date.now() + (data.expiresIn * 1000) : 
        Date.now() + (24 * 60 * 60 * 1000);
      
      this.#tokenExpiryTime = expiryTime;

      localStorage.setItem('voting_token', this.#token);
      localStorage.setItem('token_expiry', expiryTime.toString());

      this.#scheduleTokenRefresh();
      
      logger.info('Token refreshed successfully', 'AUTH');
      return this.#token;
    } catch (error) {
      logger.error('Token refresh failed', 'AUTH', error);
      throw error;
    }
  }

  // Logout user with cleanup
  logout() {
    logger.info('User logging out', 'AUTH', { userId: this.#user?.id });
    
    // Clear refresh timer
    if (this.#refreshTimer) {
      clearTimeout(this.#refreshTimer);
      this.#refreshTimer = null;
    }

    // Clear private fields
    this.#token = null;
    this.#user = null;
    this.#tokenExpiryTime = null;
    
    // Clear storage
    this.#clearStorage();
    
    logger.info('Logout completed', 'AUTH');
  }

  // Check if user is authenticated with token expiry validation
  isAuthenticated() {
    if (!this.#token) return false;
    
    // Check if token is expired
    if (this.#tokenExpiryTime && Date.now() >= this.#tokenExpiryTime) {
      logger.warn('Token expired', 'AUTH');
      this.logout();
      return false;
    }
    
    return true;
  }

  // Get current user (returns copy to prevent mutation)
  getCurrentUser() {
    if (!this.#user && this.#token) {
      this.#loadUserFromStorage();
    }
    return this.#user ? { ...this.#user } : null;
  }

  // Check if user is admin
  isAdmin() {
    return this.#user?.role === 'admin';
  }

  // Check if user is voter
  isVoter() {
    return this.#user?.role === 'voter';
  }

  // Get user role
  getUserRole() {
    return this.#user?.role || null;
  }

  // Get token (getter method)
  getToken() {
    return this.#token;
  }

  // Verify token with server using modern error handling
  async verifyToken() {
    if (!this.#token) {
      return false;
    }

    try {
      const response = await ErrorHandler.withTimeout(
        fetch(`${this.#apiBase}/verify`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.#token}`
          }
        }),
        5000 // 5 second timeout
      );

      if (response.ok) {
        logger.debug('Token verification successful', 'AUTH');
        return true;
      } else {
        logger.warn('Token verification failed', 'AUTH', { status: response.status });
        return false;
      }
    } catch (error) {
      logger.error('Token verification error', 'AUTH', error);
      return false;
    }
  }

  // Get authorization header
  getAuthHeader() {
    return this.#token ? `Bearer ${this.#token}` : null;
  }

  // Get time until token expiry
  getTimeUntilExpiry() {
    if (!this.#tokenExpiryTime) return null;
    const remaining = this.#tokenExpiryTime - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  // Check if token will expire soon (within 10 minutes)
  isTokenExpiringSoon() {
    const timeUntilExpiry = this.getTimeUntilExpiry();
    return timeUntilExpiry !== null && timeUntilExpiry < (10 * 60 * 1000);
  }

  // Redirect based on role with error handling
  redirectToRolePage() {
    try {
      const user = this.getCurrentUser();
      if (!user) {
        logger.info('No user found, redirecting to login', 'AUTH');
        window.location.href = 'login-modern.html';
        return;
      }

      const targetPage = user.role === 'admin' ? 'admin-modern.html' : 'voter-modern.html';
      logger.info('Redirecting user based on role', 'AUTH', { 
        userId: user.id, 
        role: user.role, 
        targetPage 
      });
      
      window.location.href = targetPage;
    } catch (error) {
      logger.error('Failed to redirect user', 'AUTH', error);
      window.location.href = 'login-modern.html';
    }
  }

  // Static method to create instance (singleton pattern)
  static getInstance() {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }
}

// Export singleton instance
export const authManager = AuthManager.getInstance();
