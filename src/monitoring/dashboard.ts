/**
 * Real-time Monitoring and Alerting Dashboard
 * Comprehensive system monitoring for blockchain voting platform
 */

import { EventEmitter } from 'events';

export interface MonitoringConfig {
  refreshInterval: number; // milliseconds
  alertThresholds: AlertThresholds;
  enabledMetrics: string[];
  notificationChannels: NotificationChannel[];
}

export interface AlertThresholds {
  errorRate: number; // percentage
  responseTime: number; // milliseconds
  cpuUsage: number; // percentage
  memoryUsage: number; // percentage
  diskUsage: number; // percentage
  activeConnections: number;
  failedTransactions: number;
  gasPrice: number; // gwei
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  endpoint: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

export interface SystemMetrics {
  timestamp: number;
  system: SystemHealth;
  application: ApplicationMetrics;
  blockchain: BlockchainMetrics;
  security: SecurityMetrics;
  user: UserMetrics;
}

export interface SystemHealth {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkLatency: number;
  uptime: number;
  loadAverage: number[];
}

export interface ApplicationMetrics {
  activeUsers: number;
  totalRequests: number;
  errorRate: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  cacheHitRate: number;
  databaseConnections: number;
}

export interface BlockchainMetrics {
  networkStatus: 'connected' | 'disconnected' | 'syncing';
  blockHeight: number;
  gasPrice: number;
  pendingTransactions: number;
  failedTransactions: number;
  averageConfirmationTime: number;
  networkHashRate: number;
}

export interface SecurityMetrics {
  failedLogins: number;
  suspiciousActivity: number;
  blockedIPs: number;
  vulnerabilityAlerts: number;
  lastSecurityScan: number;
  complianceScore: number;
}

export interface UserMetrics {
  activeVoters: number;
  completedVotes: number;
  abandonedSessions: number;
  averageSessionDuration: number;
  deviceBreakdown: { [key: string]: number };
  geographicDistribution: { [key: string]: number };
}

export interface Alert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
  resolved: boolean;
  metadata?: any;
}

/**
 * Real-time Monitoring Dashboard
 * Central hub for system monitoring and alerting
 */
export class MonitoringDashboard extends EventEmitter {
  private config: MonitoringConfig;
  private metrics: SystemMetrics[] = [];
  private alerts: Alert[] = [];
  private isRunning: boolean = false;
  private metricsCollectors: Map<string, MetricsCollector>;

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
    this.metricsCollectors = new Map();
    this.initializeCollectors();
  }

  /**
   * Start monitoring dashboard
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('Starting monitoring dashboard...');

    // Start metrics collection
    this.startMetricsCollection();

    // Start alert processing
    this.startAlertProcessing();

    this.emit('dashboardStarted');
  }

  /**
   * Stop monitoring dashboard
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    console.log('Stopping monitoring dashboard...');

    // Stop all collectors
    for (const collector of this.metricsCollectors.values()) {
      collector.stop();
    }

    this.emit('dashboardStopped');
  }

  /**
   * Get current system metrics
   */
  getCurrentMetrics(): SystemMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(hours: number = 24): SystemMetrics[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.metrics.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alertAcknowledged', alert);
    }
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      this.emit('alertResolved', alert);
    }
  }

  /**
   * Initialize metrics collectors
   */
  private initializeCollectors(): void {
    this.metricsCollectors.set('system', new SystemMetricsCollector());
    this.metricsCollectors.set('application', new ApplicationMetricsCollector());
    this.metricsCollectors.set('blockchain', new BlockchainMetricsCollector());
    this.metricsCollectors.set('security', new SecurityMetricsCollector());
    this.metricsCollectors.set('user', new UserMetricsCollector());
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    const collectMetrics = async () => {
      if (!this.isRunning) return;

      try {
        const timestamp = Date.now();
        const systemMetrics: SystemMetrics = {
          timestamp,
          system: await this.metricsCollectors.get('system')!.collect(),
          application: await this.metricsCollectors.get('application')!.collect(),
          blockchain: await this.metricsCollectors.get('blockchain')!.collect(),
          security: await this.metricsCollectors.get('security')!.collect(),
          user: await this.metricsCollectors.get('user')!.collect()
        };

        this.metrics.push(systemMetrics);
        
        // Keep only last 24 hours of metrics
        const cutoff = timestamp - (24 * 60 * 60 * 1000);
        this.metrics = this.metrics.filter(m => m.timestamp >= cutoff);

        // Check for alerts
        this.checkAlerts(systemMetrics);

        this.emit('metricsUpdated', systemMetrics);
      } catch (error) {
        console.error('Error collecting metrics:', error);
      }

      // Schedule next collection
      setTimeout(collectMetrics, this.config.refreshInterval);
    };

    collectMetrics();
  }

  /**
   * Check metrics against alert thresholds
   */
  private checkAlerts(metrics: SystemMetrics): void {
    const { alertThresholds } = this.config;

    // System alerts
    if (metrics.system.cpuUsage > alertThresholds.cpuUsage) {
      this.createAlert('high', 'system', `High CPU usage: ${metrics.system.cpuUsage.toFixed(1)}%`);
    }

    if (metrics.system.memoryUsage > alertThresholds.memoryUsage) {
      this.createAlert('high', 'system', `High memory usage: ${metrics.system.memoryUsage.toFixed(1)}%`);
    }

    if (metrics.system.diskUsage > alertThresholds.diskUsage) {
      this.createAlert('medium', 'system', `High disk usage: ${metrics.system.diskUsage.toFixed(1)}%`);
    }

    // Application alerts
    if (metrics.application.errorRate > alertThresholds.errorRate) {
      this.createAlert('critical', 'application', `High error rate: ${metrics.application.errorRate.toFixed(2)}%`);
    }

    if (metrics.application.averageResponseTime > alertThresholds.responseTime) {
      this.createAlert('medium', 'application', `Slow response time: ${metrics.application.averageResponseTime.toFixed(0)}ms`);
    }

    // Blockchain alerts
    if (metrics.blockchain.failedTransactions > alertThresholds.failedTransactions) {
      this.createAlert('high', 'blockchain', `High transaction failure rate: ${metrics.blockchain.failedTransactions}`);
    }

    if (metrics.blockchain.gasPrice > alertThresholds.gasPrice) {
      this.createAlert('medium', 'blockchain', `High gas price: ${metrics.blockchain.gasPrice} gwei`);
    }

    if (metrics.blockchain.networkStatus !== 'connected') {
      this.createAlert('critical', 'blockchain', `Blockchain network disconnected: ${metrics.blockchain.networkStatus}`);
    }

    // Security alerts
    if (metrics.security.failedLogins > 10) {
      this.createAlert('high', 'security', `Multiple failed login attempts: ${metrics.security.failedLogins}`);
    }

    if (metrics.security.vulnerabilityAlerts > 0) {
      this.createAlert('critical', 'security', `Security vulnerabilities detected: ${metrics.security.vulnerabilityAlerts}`);
    }
  }

  /**
   * Create new alert
   */
  private createAlert(severity: Alert['severity'], type: string, message: string, metadata?: any): void {
    // Check if similar alert already exists
    const existingAlert = this.alerts.find(a => 
      !a.resolved && a.type === type && a.message === message
    );

    if (existingAlert) return;

    const alert: Alert = {
      id: this.generateAlertId(),
      severity,
      type,
      message,
      timestamp: Date.now(),
      acknowledged: false,
      resolved: false,
      metadata
    };

    this.alerts.push(alert);
    this.emit('newAlert', alert);

    // Send notifications
    this.sendNotifications(alert);
  }

  /**
   * Start alert processing
   */
  private startAlertProcessing(): void {
    // Auto-resolve alerts after certain conditions
    setInterval(() => {
      if (!this.isRunning) return;

      const currentMetrics = this.getCurrentMetrics();
      if (!currentMetrics) return;

      // Auto-resolve system alerts if metrics are back to normal
      this.alerts.forEach(alert => {
        if (alert.resolved || alert.type !== 'system') return;

        if (alert.message.includes('CPU usage') && 
            currentMetrics.system.cpuUsage <= this.config.alertThresholds.cpuUsage) {
          this.resolveAlert(alert.id);
        }

        if (alert.message.includes('memory usage') && 
            currentMetrics.system.memoryUsage <= this.config.alertThresholds.memoryUsage) {
          this.resolveAlert(alert.id);
        }
      });
    }, 60000); // Check every minute
  }

  /**
   * Send notifications for alert
   */
  private async sendNotifications(alert: Alert): Promise<void> {
    const channels = this.config.notificationChannels.filter(c => 
      c.enabled && this.shouldNotify(c.severity, alert.severity)
    );

    for (const channel of channels) {
      try {
        await this.sendNotification(channel, alert);
      } catch (error) {
        console.error(`Failed to send notification via ${channel.type}:`, error);
      }
    }
  }

  /**
   * Check if notification should be sent based on severity
   */
  private shouldNotify(channelSeverity: string, alertSeverity: string): boolean {
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    return severityLevels[alertSeverity] >= severityLevels[channelSeverity];
  }

  /**
   * Send notification via specific channel
   */
  private async sendNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    const message = `[${alert.severity.toUpperCase()}] ${alert.type}: ${alert.message}`;

    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(channel.endpoint, message, alert);
        break;
      case 'slack':
        await this.sendSlackNotification(channel.endpoint, message, alert);
        break;
      case 'webhook':
        await this.sendWebhookNotification(channel.endpoint, alert);
        break;
      case 'sms':
        await this.sendSMSNotification(channel.endpoint, message);
        break;
    }
  }

  private async sendEmailNotification(email: string, message: string, alert: Alert): Promise<void> {
    // Email notification implementation
    console.log(`Email notification sent to ${email}: ${message}`);
  }

  private async sendSlackNotification(webhook: string, message: string, alert: Alert): Promise<void> {
    // Slack notification implementation
    const payload = {
      text: message,
      attachments: [{
        color: this.getAlertColor(alert.severity),
        fields: [
          { title: 'Severity', value: alert.severity, short: true },
          { title: 'Type', value: alert.type, short: true },
          { title: 'Time', value: new Date(alert.timestamp).toISOString(), short: false }
        ]
      }]
    };

    // In production, use actual HTTP client
    console.log(`Slack notification: ${JSON.stringify(payload)}`);
  }

  private async sendWebhookNotification(url: string, alert: Alert): Promise<void> {
    // Webhook notification implementation
    console.log(`Webhook notification sent to ${url}:`, alert);
  }

  private async sendSMSNotification(phone: string, message: string): Promise<void> {
    // SMS notification implementation
    console.log(`SMS sent to ${phone}: ${message}`);
  }

  private getAlertColor(severity: string): string {
    const colors = {
      low: '#36a64f',
      medium: '#ff9500',
      high: '#ff4500',
      critical: '#ff0000'
    };
    return colors[severity] || '#808080';
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Base class for metrics collectors
 */
abstract class MetricsCollector {
  abstract collect(): Promise<any>;
  
  stop(): void {
    // Override in subclasses if needed
  }
}

/**
 * System metrics collector
 */
class SystemMetricsCollector extends MetricsCollector {
  async collect(): Promise<SystemHealth> {
    // In production, use actual system monitoring libraries
    return {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      diskUsage: Math.random() * 100,
      networkLatency: Math.random() * 100,
      uptime: Date.now() - (Math.random() * 86400000),
      loadAverage: [Math.random() * 2, Math.random() * 2, Math.random() * 2]
    };
  }
}

/**
 * Application metrics collector
 */
class ApplicationMetricsCollector extends MetricsCollector {
  async collect(): Promise<ApplicationMetrics> {
    return {
      activeUsers: Math.floor(Math.random() * 1000),
      totalRequests: Math.floor(Math.random() * 10000),
      errorRate: Math.random() * 10,
      averageResponseTime: Math.random() * 2000,
      p95ResponseTime: Math.random() * 5000,
      p99ResponseTime: Math.random() * 10000,
      cacheHitRate: Math.random() * 100,
      databaseConnections: Math.floor(Math.random() * 50)
    };
  }
}

/**
 * Blockchain metrics collector
 */
class BlockchainMetricsCollector extends MetricsCollector {
  async collect(): Promise<BlockchainMetrics> {
    return {
      networkStatus: 'connected',
      blockHeight: Math.floor(Math.random() * 1000000),
      gasPrice: Math.random() * 100,
      pendingTransactions: Math.floor(Math.random() * 100),
      failedTransactions: Math.floor(Math.random() * 10),
      averageConfirmationTime: Math.random() * 30000,
      networkHashRate: Math.random() * 1000000
    };
  }
}

/**
 * Security metrics collector
 */
class SecurityMetricsCollector extends MetricsCollector {
  async collect(): Promise<SecurityMetrics> {
    return {
      failedLogins: Math.floor(Math.random() * 20),
      suspiciousActivity: Math.floor(Math.random() * 5),
      blockedIPs: Math.floor(Math.random() * 10),
      vulnerabilityAlerts: Math.floor(Math.random() * 3),
      lastSecurityScan: Date.now() - (Math.random() * 86400000),
      complianceScore: Math.random() * 100
    };
  }
}

/**
 * User metrics collector
 */
class UserMetricsCollector extends MetricsCollector {
  async collect(): Promise<UserMetrics> {
    return {
      activeVoters: Math.floor(Math.random() * 500),
      completedVotes: Math.floor(Math.random() * 1000),
      abandonedSessions: Math.floor(Math.random() * 50),
      averageSessionDuration: Math.random() * 1800000,
      deviceBreakdown: {
        desktop: Math.floor(Math.random() * 300),
        mobile: Math.floor(Math.random() * 200),
        tablet: Math.floor(Math.random() * 100)
      },
      geographicDistribution: {
        'North America': Math.floor(Math.random() * 200),
        'Europe': Math.floor(Math.random() * 150),
        'Asia': Math.floor(Math.random() * 100),
        'Other': Math.floor(Math.random() * 50)
      }
    };
  }
}
