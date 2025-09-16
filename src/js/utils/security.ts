// Security utilities and best practices
import { logger } from './logger';
import type { SecurityConfig, CSPDirectives, RateLimitConfig } from '@/types';

export class SecurityManager {
  private static instance: SecurityManager;
  private config: SecurityConfig;
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  private constructor() {
    this.config = {
      maxLoginAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15 minutes
      sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
      csrfTokenLength: 32,
      passwordMinLength: 8,
      requireSpecialChars: true,
      enableCSP: true,
      enableHSTS: true,
      rateLimiting: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100,
        skipSuccessfulRequests: false
      }
    };
  }

  static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  // Content Security Policy
  generateCSP(): CSPDirectives {
    return {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        "'unsafe-inline'", // Required for inline scripts (consider removing in production)
        'https://cdn.jsdelivr.net',
        'https://unpkg.com'
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Required for inline styles
        'https://fonts.googleapis.com'
      ],
      'font-src': [
        "'self'",
        'https://fonts.gstatic.com'
      ],
      'img-src': [
        "'self'",
        'data:',
        'https:'
      ],
      'connect-src': [
        "'self'",
        'ws://localhost:*',
        'wss://localhost:*',
        'http://127.0.0.1:*',
        'https://mainnet.infura.io',
        'https://goerli.infura.io'
      ],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"]
    };
  }

  // Apply CSP to document
  applyCSP(): void {
    if (!this.config.enableCSP) return;

    const csp = this.generateCSP();
    const cspString = Object.entries(csp)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');

    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = cspString;
    document.head.appendChild(meta);

    logger.info('Content Security Policy applied', 'SECURITY');
  }

  // Input sanitization
  sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';

    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  // HTML encoding
  encodeHTML(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Decode HTML entities
  decodeHTML(str: string): string {
    const div = document.createElement('div');
    div.innerHTML = str;
    return div.textContent || div.innerText || '';
  }

  // Generate CSRF token
  generateCSRFToken(): string {
    const array = new Uint8Array(this.config.csrfTokenLength);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Validate CSRF token
  validateCSRFToken(token: string, storedToken: string): boolean {
    if (!token || !storedToken) return false;
    return token === storedToken;
  }

  // Password strength validation
  validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < this.config.passwordMinLength) {
      errors.push(`Password must be at least ${this.config.passwordMinLength} characters long`);
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (this.config.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common weak passwords
    const weakPasswords = [
      'password', '123456', 'password123', 'admin', 'qwerty',
      'letmein', 'welcome', 'monkey', '1234567890'
    ];

    if (weakPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common and easily guessable');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Rate limiting
  checkRateLimit(identifier: string, config?: Partial<RateLimitConfig>): boolean {
    const rateLimitConfig = { ...this.config.rateLimiting, ...config };
    const now = Date.now();
    const key = `rate_limit_${identifier}`;

    const existing = this.rateLimitMap.get(key);

    if (!existing || now > existing.resetTime) {
      // Reset or create new entry
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + rateLimitConfig.windowMs
      });
      return true;
    }

    if (existing.count >= rateLimitConfig.maxRequests) {
      logger.warn('Rate limit exceeded', 'SECURITY', { 
        identifier, 
        count: existing.count,
        limit: rateLimitConfig.maxRequests 
      });
      return false;
    }

    existing.count++;
    return true;
  }

  // Secure random string generation
  generateSecureRandom(length: number = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Hash data using Web Crypto API
  async hashData(data: string, algorithm: 'SHA-256' | 'SHA-384' | 'SHA-512' = 'SHA-256'): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest(algorithm, dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Secure storage wrapper
  secureStorage = {
    setItem: (key: string, value: string): void => {
      try {
        const encrypted = this.simpleEncrypt(value);
        localStorage.setItem(key, encrypted);
      } catch (error) {
        logger.error('Failed to store secure item', 'SECURITY', error);
      }
    },

    getItem: (key: string): string | null => {
      try {
        const encrypted = localStorage.getItem(key);
        if (!encrypted) return null;
        return this.simpleDecrypt(encrypted);
      } catch (error) {
        logger.error('Failed to retrieve secure item', 'SECURITY', error);
        return null;
      }
    },

    removeItem: (key: string): void => {
      localStorage.removeItem(key);
    }
  };

  // Simple encryption for client-side storage (not cryptographically secure)
  private simpleEncrypt(text: string): string {
    const key = this.getStorageKey();
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(result);
  }

  private simpleDecrypt(encrypted: string): string {
    const key = this.getStorageKey();
    const text = atob(encrypted);
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  }

  private getStorageKey(): string {
    // Generate a key based on domain and user agent (basic obfuscation)
    return btoa(window.location.hostname + navigator.userAgent.slice(0, 50));
  }

  // Validate Ethereum address
  isValidEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  // Validate transaction hash
  isValidTransactionHash(hash: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/.test(hash);
  }

  // Check for suspicious activity patterns
  detectSuspiciousActivity(events: Array<{ type: string; timestamp: number; data?: any }>): boolean {
    const now = Date.now();
    const recentEvents = events.filter(event => now - event.timestamp < 60000); // Last minute

    // Too many failed login attempts
    const failedLogins = recentEvents.filter(event => event.type === 'login_failed');
    if (failedLogins.length > 3) {
      logger.warn('Suspicious activity: Multiple failed logins', 'SECURITY');
      return true;
    }

    // Rapid successive actions
    const actionEvents = recentEvents.filter(event => 
      ['vote_cast', 'election_created', 'candidate_added'].includes(event.type)
    );
    if (actionEvents.length > 10) {
      logger.warn('Suspicious activity: Too many rapid actions', 'SECURITY');
      return true;
    }

    return false;
  }

  // Security headers for fetch requests
  getSecurityHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };

    // Add CSRF token if available
    const csrfToken = sessionStorage.getItem('csrf_token');
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    return headers;
  }

  // Initialize security measures
  initialize(): void {
    logger.info('Initializing security measures', 'SECURITY');

    // Apply CSP
    this.applyCSP();

    // Generate and store CSRF token
    const csrfToken = this.generateCSRFToken();
    sessionStorage.setItem('csrf_token', csrfToken);

    // Set up security event listeners
    this.setupSecurityEventListeners();

    // Clear rate limit map periodically
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.rateLimitMap.entries()) {
        if (now > value.resetTime) {
          this.rateLimitMap.delete(key);
        }
      }
    }, 60000); // Clean up every minute

    logger.info('Security measures initialized', 'SECURITY');
  }

  private setupSecurityEventListeners(): void {
    // Detect potential XSS attempts
    document.addEventListener('DOMNodeInserted', (event) => {
      const target = event.target as Element;
      if (target.nodeType === Node.ELEMENT_NODE) {
        const scripts = target.querySelectorAll('script');
        if (scripts.length > 0) {
          logger.warn('Potential XSS attempt detected', 'SECURITY', {
            element: target.tagName,
            scripts: scripts.length
          });
        }
      }
    });

    // Monitor for suspicious console access
    let consoleAccessCount = 0;
    const originalConsole = window.console;
    Object.defineProperty(window, 'console', {
      get: () => {
        consoleAccessCount++;
        if (consoleAccessCount > 50) {
          logger.warn('Excessive console access detected', 'SECURITY');
        }
        return originalConsole;
      }
    });
  }

  // Get current security configuration
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  // Update security configuration
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Security configuration updated', 'SECURITY');
  }
}

// Export singleton instance
export const securityManager = SecurityManager.getInstance();
