// Modern logging utility with multiple transports and levels
import type { VotingError } from '@/types';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: any;
  error?: Error;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  private constructor() {
    // Set log level based on environment
    if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
      this.logLevel = LogLevel.DEBUG;
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: string,
    data?: any,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data,
      error,
    };
  }

  private formatMessage(entry: LogEntry): string {
    const levelName = LogLevel[entry.level];
    const contextStr = entry.context ? `[${entry.context}]` : '';
    return `${entry.timestamp} ${levelName} ${contextStr} ${entry.message}`;
  }

  private addLog(entry: LogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output with appropriate method
    const formattedMessage = this.formatMessage(entry);
    
    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(formattedMessage, entry.data, entry.error);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, entry.data);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, entry.data);
        break;
      case LogLevel.DEBUG:
        console.debug(formattedMessage, entry.data);
        break;
    }

    // Send to analytics in production
    if (typeof window !== 'undefined' && window.location?.hostname !== 'localhost' && entry.level <= LogLevel.WARN) {
      this.sendToAnalytics(entry);
    }
  }

  private async sendToAnalytics(entry: LogEntry): Promise<void> {
    try {
      // Send to analytics service (implement based on your analytics provider)
      await fetch('/api/analytics/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: LogLevel[entry.level],
          message: entry.message,
          context: entry.context,
          timestamp: entry.timestamp,
          userAgent: navigator.userAgent,
          url: window.location.href,
        }),
      });
    } catch (error) {
      // Fail silently for analytics
    }
  }

  error(message: string, context?: string, data?: any, error?: Error): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.addLog(this.createLogEntry(LogLevel.ERROR, message, context, data, error));
    }
  }

  warn(message: string, context?: string, data?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.addLog(this.createLogEntry(LogLevel.WARN, message, context, data));
    }
  }

  info(message: string, context?: string, data?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.addLog(this.createLogEntry(LogLevel.INFO, message, context, data));
    }
  }

  debug(message: string, context?: string, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.addLog(this.createLogEntry(LogLevel.DEBUG, message, context, data));
    }
  }

  // Specialized methods for common scenarios
  logVotingError(error: VotingError, context?: string): void {
    this.error(error.message, context, { code: error.code, details: error.details }, error);
  }

  logTransaction(hash: string, context: string, data?: any): void {
    this.info(`Transaction: ${hash}`, context, data);
  }

  logWalletEvent(event: string, account?: string, data?: any): void {
    this.info(`Wallet ${event}`, 'WALLET', { account, ...data });
  }

  logElectionEvent(event: string, electionId: number, data?: any): void {
    this.info(`Election ${event}`, 'ELECTION', { electionId, ...data });
  }

  // Get logs for debugging
  getLogs(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.logs.filter(log => log.level <= level);
    }
    return [...this.logs];
  }

  // Clear logs
  clearLogs(): void {
    this.logs = [];
  }

  // Export logs for support
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Set log level dynamically
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info(`Log level set to ${LogLevel[level]}`, 'LOGGER');
  }
}

// Create singleton instance
export const logger = Logger.getInstance();

// Performance monitoring
export class PerformanceMonitor {
  private static marks = new Map<string, number>();

  static start(name: string): void {
    this.marks.set(name, performance.now());
    logger.debug(`Performance mark started: ${name}`, 'PERFORMANCE');
  }

  static end(name: string): number {
    const startTime = this.marks.get(name);
    if (!startTime) {
      logger.warn(`No start mark found for: ${name}`, 'PERFORMANCE');
      return 0;
    }

    const duration = performance.now() - startTime;
    this.marks.delete(name);
    
    logger.info(`Performance: ${name} took ${duration.toFixed(2)}ms`, 'PERFORMANCE');
    return duration;
  }

  static measure(name: string, fn: () => Promise<any>): Promise<any> {
    return new Promise(async (resolve, reject) => {
      this.start(name);
      try {
        const result = await fn();
        this.end(name);
        resolve(result);
      } catch (error) {
        this.end(name);
        reject(error);
      }
    });
  }
}

// Error boundary for unhandled errors
export function setupGlobalErrorHandling(): void {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', 'GLOBAL', {
      reason: event.reason,
      promise: event.promise,
    });
    
    // Prevent default browser behavior
    event.preventDefault();
  });

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    logger.error('Uncaught error', 'GLOBAL', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    }, event.error);
  });

  // Log page visibility changes
  document.addEventListener('visibilitychange', () => {
    logger.info(`Page visibility: ${document.hidden ? 'hidden' : 'visible'}`, 'LIFECYCLE');
  });

  // Log page load performance
  window.addEventListener('load', () => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    logger.info('Page load performance', 'PERFORMANCE', {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      totalTime: navigation.loadEventEnd - navigation.fetchStart,
    });
  });
}
