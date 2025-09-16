// Comprehensive error handling utilities
import { logger } from './logger.ts';

// Export error classes for use in other modules
export class ValidationError extends Error {
  constructor(message: string, public code?: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public code?: string, public details?: any) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string, public code?: string, public details?: any) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class BlockchainError extends Error {
  constructor(message: string, public code?: string, public details?: any) {
    super(message);
    this.name = 'BlockchainError';
  }
}

export class VotingError extends Error {
  constructor(message: string, public code?: string, public details?: any) {
    super(message);
    this.name = 'VotingError';
  }
}

export class ErrorHandler {
  private static retryAttempts = new Map<string, number>();
  private static maxRetries = 3;
  private static retryDelay = 1000; // 1 second

  static async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries = this.maxRetries
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        // Reset retry count on success
        this.retryAttempts.delete(operationName);
        return result;
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Attempt ${attempt}/${maxRetries} failed for ${operationName}`, 'ERROR_HANDLER', {
          error: error instanceof Error ? error.message : error,
        });

        if (attempt < maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    this.retryAttempts.set(operationName, maxRetries);
    throw lastError!;
  }

  static async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    operationName: string
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation ${operationName} timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  static handleBlockchainError(error: any): BlockchainError {
    let message = 'Blockchain operation failed';
    let details = {};

    if (error?.code) {
      switch (error.code) {
        case 4001:
          message = 'Transaction rejected by user';
          break;
        case -32603:
          message = 'Internal JSON-RPC error';
          break;
        case -32602:
          message = 'Invalid method parameters';
          break;
        default:
          message = `Blockchain error (${error.code})`;
      }
    }

    if (error?.message) {
      if (error.message.includes('insufficient funds')) {
        message = 'Insufficient funds for transaction';
      } else if (error.message.includes('nonce too low')) {
        message = 'Transaction nonce too low';
      } else if (error.message.includes('gas')) {
        message = 'Gas estimation failed';
      }
    }

    details = {
      originalError: error?.message || error,
      code: error?.code,
      data: error?.data,
    };

    const blockchainError = new BlockchainError(message, 'BLOCKCHAIN_ERROR', details);
    logger.error(`Blockchain Error: ${message}`, 'BLOCKCHAIN', details);
    return blockchainError;
  }

  static handleAuthError(error: any): AuthenticationError {
    let message = 'Authentication failed';
    
    if (error?.status === 401) {
      message = 'Invalid credentials';
    } else if (error?.status === 403) {
      message = 'Access denied';
    } else if (error?.status === 429) {
      message = 'Too many login attempts. Please try again later.';
    }

    const authError = new AuthenticationError(message, 'AUTH_ERROR', {
      originalError: error?.message || error,
      status: error?.status,
    });
    
    logger.error(`Authentication Error: ${message}`, 'AUTH', { status: error?.status });
    return authError;
  }

  static handleValidationError(errors: string[]): ValidationError {
    const message = `Validation failed: ${errors.join(', ')}`;
    const validationError = new ValidationError(message, 'VALIDATION_ERROR', { errors });
    
    logger.error(`Validation Error: ${message}`, 'VALIDATION', { errors });
    return validationError;
  }

  static async handleApiError(response: Response): Promise<never> {
    let errorData: any = {};
    
    try {
      errorData = await response.json();
    } catch {
      // Response might not be JSON
    }

    const message = errorData.message || `HTTP ${response.status}: ${response.statusText}`;
    
    let error: VotingError;
    
    if (response.status >= 400 && response.status < 500) {
      error = this.handleAuthError({ status: response.status, message });
    } else {
      error = new VotingError(message, 'API_ERROR', {
        status: response.status,
        statusText: response.statusText,
        data: errorData,
      });
    }

    throw error;
  }

  static showUserFriendlyError(error: Error): void {
    let userMessage = 'An unexpected error occurred. Please try again.';
    let type: 'error' | 'warning' = 'error';

    if (error instanceof AuthenticationError) {
      userMessage = error.message;
      type = 'warning';
    } else if (error instanceof ValidationError) {
      userMessage = error.message;
      type = 'warning';
    } else if (error instanceof BlockchainError) {
      if (error.message.includes('rejected')) {
        userMessage = 'Transaction was cancelled';
        type = 'warning';
      } else if (error.message.includes('insufficient funds')) {
        userMessage = 'Insufficient funds to complete transaction';
      } else {
        userMessage = 'Blockchain operation failed. Please check your connection and try again.';
      }
    }

    // Show notification to user (assuming UIManager is available)
    if (window.uiManager) {
      window.uiManager.showNotification(userMessage, type);
    } else {
      // Fallback to alert
      alert(userMessage);
    }
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static isRetryableError(error: Error): boolean {
    if (error instanceof BlockchainError) {
      // Don't retry user rejections or insufficient funds
      return !error.message.includes('rejected') && !error.message.includes('insufficient funds');
    }
    
    if (error instanceof AuthenticationError) {
      // Don't retry auth errors
      return false;
    }

    // Retry network errors
    return error.message.includes('network') || 
           error.message.includes('timeout') ||
           error.message.includes('fetch');
  }

  static getErrorContext(error: Error): Record<string, any> {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...(error instanceof VotingError && { 
        code: error.code, 
        details: error.details 
      }),
    };
  }
}

// Circuit breaker pattern for failing services
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold = 5,
    private timeout = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
        logger.info(`Circuit breaker half-open for ${operationName}`, 'CIRCUIT_BREAKER');
      } else {
        throw new Error(`Circuit breaker is OPEN for ${operationName}`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess(operationName);
      return result;
    } catch (error) {
      this.onFailure(operationName);
      throw error;
    }
  }

  private onSuccess(operationName: string): void {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      logger.info(`Circuit breaker closed for ${operationName}`, 'CIRCUIT_BREAKER');
    }
  }

  private onFailure(operationName: string): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      logger.warn(`Circuit breaker opened for ${operationName} after ${this.failures} failures`, 'CIRCUIT_BREAKER');
    }
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.failures = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = 0;
  }
}

// Global error boundary setup
export function setupErrorBoundary(): void {
  // Wrap async operations
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    try {
      const response = await originalFetch(...args);
      if (!response.ok) {
        await ErrorHandler.handleApiError(response);
      }
      return response;
    } catch (error) {
      if (ErrorHandler.isRetryableError(error as Error)) {
        return ErrorHandler.withRetry(() => originalFetch(...args), 'fetch');
      }
      throw error;
    }
  };

  // Handle promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    logger.error('Unhandled promise rejection', 'ERROR_BOUNDARY', ErrorHandler.getErrorContext(error));
    ErrorHandler.showUserFriendlyError(error);
  });
}
