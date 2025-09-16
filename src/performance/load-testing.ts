/**
 * Load Testing and Performance Optimization System
 * Comprehensive testing framework for blockchain voting system
 */

import { EventEmitter } from 'events';

export interface LoadTestConfig {
  maxUsers: number;
  rampUpTime: number; // seconds
  testDuration: number; // seconds
  scenarios: LoadTestScenario[];
  endpoints: TestEndpoint[];
  blockchain: BlockchainTestConfig;
}

export interface LoadTestScenario {
  name: string;
  weight: number; // percentage of users
  actions: TestAction[];
  thinkTime: number; // seconds between actions
}

export interface TestAction {
  type: 'http_request' | 'blockchain_transaction' | 'wait' | 'validate';
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  payload?: any;
  validation?: ValidationRule[];
  timeout?: number;
}

export interface TestEndpoint {
  path: string;
  method: string;
  expectedResponseTime: number; // milliseconds
  maxErrorRate: number; // percentage
}

export interface BlockchainTestConfig {
  networkUrl: string;
  gasLimit: number;
  gasPrice: string;
  concurrentTransactions: number;
  blockConfirmations: number;
}

export interface ValidationRule {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}

export interface LoadTestResults {
  summary: TestSummary;
  scenarios: ScenarioResults[];
  endpoints: EndpointResults[];
  blockchain: BlockchainResults;
  errors: TestError[];
  recommendations: string[];
}

export interface TestSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  testDuration: number;
}

export interface ScenarioResults {
  name: string;
  users: number;
  completedActions: number;
  failedActions: number;
  averageActionTime: number;
  successRate: number;
}

export interface EndpointResults {
  path: string;
  method: string;
  requests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  errorRate: number;
  throughput: number;
  passed: boolean;
}

export interface BlockchainResults {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  averageGasUsed: number;
  averageConfirmationTime: number;
  maxConfirmationTime: number;
  networkCongestion: number;
  costAnalysis: GasCostAnalysis;
}

export interface GasCostAnalysis {
  totalGasCost: string;
  averageCostPerVote: string;
  peakGasPrice: string;
  recommendedGasPrice: string;
}

export interface TestError {
  timestamp: number;
  scenario: string;
  action: string;
  error: string;
  responseTime?: number;
  statusCode?: number;
}

/**
 * Load Testing Engine
 * Orchestrates comprehensive performance testing
 */
export class LoadTestEngine extends EventEmitter {
  private config: LoadTestConfig;
  private results: LoadTestResults;
  private activeUsers: Map<string, VirtualUser>;
  private startTime: number = 0;
  private isRunning: boolean = false;

  constructor(config: LoadTestConfig) {
    super();
    this.config = config;
    this.activeUsers = new Map();
    this.results = this.initializeResults();
  }

  /**
   * Start load testing
   */
  async startTest(): Promise<LoadTestResults> {
    if (this.isRunning) {
      throw new Error('Test is already running');
    }

    this.isRunning = true;
    this.startTime = Date.now();
    this.results = this.initializeResults();

    console.log(`Starting load test with ${this.config.maxUsers} users`);
    this.emit('testStarted', { maxUsers: this.config.maxUsers });

    try {
      // Ramp up users gradually
      await this.rampUpUsers();
      
      // Run test scenarios
      await this.runTestScenarios();
      
      // Ramp down users
      await this.rampDownUsers();
      
      // Generate final results
      this.finalizeResults();
      
      console.log('Load test completed successfully');
      this.emit('testCompleted', this.results);
      
      return this.results;
    } catch (error) {
      console.error('Load test failed:', error);
      this.emit('testFailed', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Stop running test
   */
  async stopTest(): Promise<void> {
    if (!this.isRunning) return;

    console.log('Stopping load test...');
    this.isRunning = false;

    // Stop all virtual users
    const stopPromises = Array.from(this.activeUsers.values()).map(user => user.stop());
    await Promise.all(stopPromises);

    this.activeUsers.clear();
    this.finalizeResults();
    
    this.emit('testStopped', this.results);
  }

  /**
   * Ramp up virtual users gradually
   */
  private async rampUpUsers(): Promise<void> {
    const rampUpInterval = (this.config.rampUpTime * 1000) / this.config.maxUsers;
    
    for (let i = 0; i < this.config.maxUsers; i++) {
      if (!this.isRunning) break;
      
      const userId = `user_${i}`;
      const scenario = this.selectScenario();
      const user = new VirtualUser(userId, scenario, this.config);
      
      this.activeUsers.set(userId, user);
      
      // Start user and listen for events
      user.on('actionCompleted', (data) => this.handleActionCompleted(data));
      user.on('actionFailed', (data) => this.handleActionFailed(data));
      user.on('error', (error) => this.handleUserError(userId, error));
      
      user.start();
      
      // Wait before starting next user
      await this.sleep(rampUpInterval);
      
      this.emit('userStarted', { userId, totalUsers: i + 1 });
    }
    
    console.log(`All ${this.config.maxUsers} users started`);
  }

  /**
   * Run test scenarios for specified duration
   */
  private async runTestScenarios(): Promise<void> {
    const testEndTime = this.startTime + (this.config.testDuration * 1000);
    
    while (Date.now() < testEndTime && this.isRunning) {
      await this.sleep(1000); // Check every second
      
      // Emit progress update
      const elapsed = (Date.now() - this.startTime) / 1000;
      const progress = (elapsed / this.config.testDuration) * 100;
      this.emit('progress', { elapsed, progress });
    }
  }

  /**
   * Gradually stop virtual users
   */
  private async rampDownUsers(): Promise<void> {
    const users = Array.from(this.activeUsers.values());
    const rampDownInterval = 100; // Stop users quickly
    
    for (const user of users) {
      user.stop();
      await this.sleep(rampDownInterval);
    }
    
    this.activeUsers.clear();
    console.log('All users stopped');
  }

  /**
   * Select scenario based on weight distribution
   */
  private selectScenario(): LoadTestScenario {
    const random = Math.random() * 100;
    let cumulative = 0;
    
    for (const scenario of this.config.scenarios) {
      cumulative += scenario.weight;
      if (random <= cumulative) {
        return scenario;
      }
    }
    
    return this.config.scenarios[0]; // Fallback
  }

  /**
   * Handle completed action from virtual user
   */
  private handleActionCompleted(data: any): void {
    this.results.summary.totalRequests++;
    this.results.summary.successfulRequests++;
    
    // Update response time metrics
    this.updateResponseTimeMetrics(data.responseTime);
    
    // Update endpoint metrics
    this.updateEndpointMetrics(data.endpoint, data.method, data.responseTime, false);
    
    // Update scenario metrics
    this.updateScenarioMetrics(data.scenario, true, data.responseTime);
  }

  /**
   * Handle failed action from virtual user
   */
  private handleActionFailed(data: any): void {
    this.results.summary.totalRequests++;
    this.results.summary.failedRequests++;
    
    // Record error
    this.results.errors.push({
      timestamp: Date.now(),
      scenario: data.scenario,
      action: data.action,
      error: data.error,
      responseTime: data.responseTime,
      statusCode: data.statusCode
    });
    
    // Update endpoint metrics
    this.updateEndpointMetrics(data.endpoint, data.method, data.responseTime, true);
    
    // Update scenario metrics
    this.updateScenarioMetrics(data.scenario, false, data.responseTime);
  }

  /**
   * Handle user error
   */
  private handleUserError(userId: string, error: any): void {
    console.error(`User ${userId} error:`, error);
    
    this.results.errors.push({
      timestamp: Date.now(),
      scenario: 'system',
      action: 'user_execution',
      error: error.message || error.toString()
    });
  }

  /**
   * Update response time metrics
   */
  private updateResponseTimeMetrics(responseTime: number): void {
    // This is a simplified implementation
    // In production, you'd use a proper percentile calculation
    const current = this.results.summary.averageResponseTime;
    const total = this.results.summary.totalRequests;
    
    this.results.summary.averageResponseTime = 
      (current * (total - 1) + responseTime) / total;
  }

  /**
   * Update endpoint-specific metrics
   */
  private updateEndpointMetrics(endpoint: string, method: string, responseTime: number, isError: boolean): void {
    let endpointResult = this.results.endpoints.find(e => e.path === endpoint && e.method === method);
    
    if (!endpointResult) {
      endpointResult = {
        path: endpoint,
        method: method,
        requests: 0,
        averageResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        errorRate: 0,
        throughput: 0,
        passed: true
      };
      this.results.endpoints.push(endpointResult);
    }
    
    endpointResult.requests++;
    endpointResult.minResponseTime = Math.min(endpointResult.minResponseTime, responseTime);
    endpointResult.maxResponseTime = Math.max(endpointResult.maxResponseTime, responseTime);
    
    // Update average response time
    endpointResult.averageResponseTime = 
      (endpointResult.averageResponseTime * (endpointResult.requests - 1) + responseTime) / endpointResult.requests;
    
    // Update error rate
    if (isError) {
      endpointResult.errorRate = (endpointResult.errorRate * (endpointResult.requests - 1) + 100) / endpointResult.requests;
    } else {
      endpointResult.errorRate = (endpointResult.errorRate * (endpointResult.requests - 1)) / endpointResult.requests;
    }
  }

  /**
   * Update scenario-specific metrics
   */
  private updateScenarioMetrics(scenarioName: string, success: boolean, responseTime: number): void {
    let scenarioResult = this.results.scenarios.find(s => s.name === scenarioName);
    
    if (!scenarioResult) {
      scenarioResult = {
        name: scenarioName,
        users: 0,
        completedActions: 0,
        failedActions: 0,
        averageActionTime: 0,
        successRate: 0
      };
      this.results.scenarios.push(scenarioResult);
    }
    
    if (success) {
      scenarioResult.completedActions++;
    } else {
      scenarioResult.failedActions++;
    }
    
    const totalActions = scenarioResult.completedActions + scenarioResult.failedActions;
    scenarioResult.averageActionTime = 
      (scenarioResult.averageActionTime * (totalActions - 1) + responseTime) / totalActions;
    
    scenarioResult.successRate = (scenarioResult.completedActions / totalActions) * 100;
  }

  /**
   * Finalize test results and generate recommendations
   */
  private finalizeResults(): void {
    const duration = (Date.now() - this.startTime) / 1000;
    this.results.summary.testDuration = duration;
    this.results.summary.requestsPerSecond = this.results.summary.totalRequests / duration;
    this.results.summary.errorRate = 
      (this.results.summary.failedRequests / this.results.summary.totalRequests) * 100;

    // Check endpoint performance against expectations
    for (const endpoint of this.results.endpoints) {
      const config = this.config.endpoints.find(e => e.path === endpoint.path && e.method === endpoint.method);
      if (config) {
        endpoint.passed = endpoint.averageResponseTime <= config.expectedResponseTime && 
                         endpoint.errorRate <= config.maxErrorRate;
      }
    }

    // Generate recommendations
    this.generateRecommendations();
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): void {
    const recommendations: string[] = [];

    // Check overall error rate
    if (this.results.summary.errorRate > 5) {
      recommendations.push(`High error rate (${this.results.summary.errorRate.toFixed(2)}%). Investigate server capacity and error handling.`);
    }

    // Check response times
    if (this.results.summary.averageResponseTime > 2000) {
      recommendations.push(`High average response time (${this.results.summary.averageResponseTime.toFixed(0)}ms). Consider optimizing database queries and caching.`);
    }

    // Check failed endpoints
    const failedEndpoints = this.results.endpoints.filter(e => !e.passed);
    if (failedEndpoints.length > 0) {
      recommendations.push(`${failedEndpoints.length} endpoints failed performance criteria. Focus optimization on: ${failedEndpoints.map(e => e.path).join(', ')}`);
    }

    // Check blockchain performance
    if (this.results.blockchain.averageConfirmationTime > 30000) {
      recommendations.push(`Slow blockchain confirmations (${this.results.blockchain.averageConfirmationTime / 1000}s). Consider increasing gas price or optimizing smart contracts.`);
    }

    // Check throughput
    if (this.results.summary.requestsPerSecond < this.config.maxUsers * 0.1) {
      recommendations.push('Low throughput detected. Consider horizontal scaling or load balancing improvements.');
    }

    this.results.recommendations = recommendations;
  }

  /**
   * Initialize empty results structure
   */
  private initializeResults(): LoadTestResults {
    return {
      summary: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        requestsPerSecond: 0,
        errorRate: 0,
        testDuration: 0
      },
      scenarios: [],
      endpoints: [],
      blockchain: {
        totalTransactions: 0,
        successfulTransactions: 0,
        failedTransactions: 0,
        averageGasUsed: 0,
        averageConfirmationTime: 0,
        maxConfirmationTime: 0,
        networkCongestion: 0,
        costAnalysis: {
          totalGasCost: '0',
          averageCostPerVote: '0',
          peakGasPrice: '0',
          recommendedGasPrice: '0'
        }
      },
      errors: [],
      recommendations: []
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Virtual User
 * Simulates individual user behavior
 */
class VirtualUser extends EventEmitter {
  private userId: string;
  private scenario: LoadTestScenario;
  private config: LoadTestConfig;
  private isRunning: boolean = false;

  constructor(userId: string, scenario: LoadTestScenario, config: LoadTestConfig) {
    super();
    this.userId = userId;
    this.scenario = scenario;
    this.config = config;
  }

  /**
   * Start executing user scenario
   */
  async start(): Promise<void> {
    this.isRunning = true;
    
    try {
      while (this.isRunning) {
        for (const action of this.scenario.actions) {
          if (!this.isRunning) break;
          
          await this.executeAction(action);
          
          // Think time between actions
          if (this.scenario.thinkTime > 0) {
            await this.sleep(this.scenario.thinkTime * 1000);
          }
        }
        
        // Brief pause before repeating scenario
        await this.sleep(1000);
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Stop user execution
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * Execute individual test action
   */
  private async executeAction(action: TestAction): Promise<void> {
    const startTime = Date.now();
    
    try {
      switch (action.type) {
        case 'http_request':
          await this.executeHttpRequest(action);
          break;
        case 'blockchain_transaction':
          await this.executeBlockchainTransaction(action);
          break;
        case 'wait':
          await this.sleep((action.timeout || 1) * 1000);
          break;
        case 'validate':
          await this.executeValidation(action);
          break;
      }
      
      const responseTime = Date.now() - startTime;
      
      this.emit('actionCompleted', {
        userId: this.userId,
        scenario: this.scenario.name,
        action: action.type,
        endpoint: action.endpoint,
        method: action.method,
        responseTime
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.emit('actionFailed', {
        userId: this.userId,
        scenario: this.scenario.name,
        action: action.type,
        endpoint: action.endpoint,
        method: action.method,
        error: error.message,
        responseTime,
        statusCode: error.statusCode
      });
    }
  }

  /**
   * Execute HTTP request
   */
  private async executeHttpRequest(action: TestAction): Promise<void> {
    const url = action.endpoint;
    const options: RequestInit = {
      method: action.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `LoadTest-User-${this.userId}`
      }
    };

    if (action.payload) {
      options.body = JSON.stringify(action.payload);
    }

    const response = await fetch(url!, options);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Validate response if rules provided
    if (action.validation) {
      this.validateResponse(data, action.validation);
    }
  }

  /**
   * Execute blockchain transaction (simplified)
   */
  private async executeBlockchainTransaction(action: TestAction): Promise<void> {
    // This would integrate with Web3 or similar blockchain library
    // For now, we'll simulate blockchain transaction timing
    const simulatedGasTime = Math.random() * 15000 + 5000; // 5-20 seconds
    await this.sleep(simulatedGasTime);
    
    // Simulate occasional transaction failures
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error('Transaction failed: insufficient gas or network congestion');
    }
  }

  /**
   * Execute validation
   */
  private async executeValidation(action: TestAction): Promise<void> {
    if (!action.validation) return;
    
    // This would validate current page state or stored data
    // For now, we'll simulate validation
    await this.sleep(100);
  }

  /**
   * Validate response against rules
   */
  private validateResponse(data: any, rules: ValidationRule[]): void {
    for (const rule of rules) {
      const fieldValue = this.getNestedValue(data, rule.field);
      
      switch (rule.operator) {
        case 'equals':
          if (fieldValue !== rule.value) {
            throw new Error(`Validation failed: ${rule.field} expected ${rule.value}, got ${fieldValue}`);
          }
          break;
        case 'contains':
          if (!fieldValue.toString().includes(rule.value)) {
            throw new Error(`Validation failed: ${rule.field} should contain ${rule.value}`);
          }
          break;
        case 'greater_than':
          if (fieldValue <= rule.value) {
            throw new Error(`Validation failed: ${rule.field} should be greater than ${rule.value}`);
          }
          break;
        case 'less_than':
          if (fieldValue >= rule.value) {
            throw new Error(`Validation failed: ${rule.field} should be less than ${rule.value}`);
          }
          break;
      }
    }
  }

  /**
   * Get nested object value by dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Performance Optimizer
 * Analyzes results and provides optimization suggestions
 */
export class PerformanceOptimizer {
  /**
   * Analyze load test results and provide optimization recommendations
   */
  static analyzeResults(results: LoadTestResults): {
    bottlenecks: string[];
    optimizations: string[];
    scalingRecommendations: string[];
  } {
    const bottlenecks: string[] = [];
    const optimizations: string[] = [];
    const scalingRecommendations: string[] = [];

    // Identify bottlenecks
    if (results.summary.errorRate > 10) {
      bottlenecks.push('High error rate indicates server overload or configuration issues');
    }

    if (results.summary.averageResponseTime > 3000) {
      bottlenecks.push('High response times suggest database or processing bottlenecks');
    }

    const slowEndpoints = results.endpoints.filter(e => e.averageResponseTime > 2000);
    if (slowEndpoints.length > 0) {
      bottlenecks.push(`Slow endpoints detected: ${slowEndpoints.map(e => e.path).join(', ')}`);
    }

    // Generate optimizations
    if (results.summary.averageResponseTime > 1000) {
      optimizations.push('Implement caching layer (Redis/Memcached) for frequently accessed data');
      optimizations.push('Optimize database queries and add appropriate indexes');
    }

    if (results.blockchain.averageConfirmationTime > 20000) {
      optimizations.push('Optimize smart contract gas usage');
      optimizations.push('Implement transaction batching for better efficiency');
    }

    // Scaling recommendations
    if (results.summary.requestsPerSecond < 100) {
      scalingRecommendations.push('Consider horizontal scaling with load balancers');
      scalingRecommendations.push('Implement microservices architecture for better scalability');
    }

    if (results.blockchain.networkCongestion > 80) {
      scalingRecommendations.push('Consider layer 2 scaling solutions or alternative blockchain networks');
    }

    return {
      bottlenecks,
      optimizations,
      scalingRecommendations
    };
  }
}
