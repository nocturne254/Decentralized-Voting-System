// Type definitions for the Decentralized Voting System

export interface User {
  id: string;
  role: 'admin' | 'voter';
  walletAddress?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export interface Candidate {
  id: number;
  name: string;
  party: string;
  voteCount: number;
}

export interface Election {
  id: number;
  name: string;
  startTime: number;
  endTime: number;
  candidateCount: number;
  candidates: Candidate[];
  isActive?: boolean;
  hasVoted?: boolean;
}

export interface VoteResult {
  transactionHash: string;
  blockNumber?: number;
}

export interface NetworkInfo {
  networkId: number | null;
  blockNumber: number | null;
  isConnected: boolean;
}

export interface WalletState {
  isConnected: boolean;
  account: string | null;
  balance?: string;
  networkId?: number;
}

export interface NotificationOptions {
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  persistent?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ElectionFormData {
  name: string;
  startDate: string;
  endDate: string;
  candidates: Array<{
    name: string;
    party: string;
  }>;
}

export interface Statistics {
  totalElections: number;
  activeElections: number;
  totalVotes: number;
  totalCandidates: number;
}

// Smart Contract Types
export interface ContractEvent {
  event: string;
  returnValues: Record<string, any>;
  transactionHash: string;
  blockNumber: number;
}

export interface TransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  gasUsed: number;
  status: boolean;
}

// WebSocket Types - removed duplicate, using definition below

// Error Types
export class VotingError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'VotingError';
  }
}

export class BlockchainError extends VotingError {
  constructor(message: string, details?: any) {
    super(message, 'BLOCKCHAIN_ERROR', details);
    this.name = 'BlockchainError';
  }
}

export class AuthenticationError extends VotingError {
  constructor(message: string, details?: any) {
    super(message, 'AUTH_ERROR', details);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends VotingError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

// Utility Types
export type ElectionStatus = 'upcoming' | 'active' | 'ended';

export type Theme = 'light' | 'dark' | 'auto';

export interface AppConfig {
  apiBaseUrl: string;
  contractAddress: string;
  networkId: number;
  theme: Theme;
  enableNotifications: boolean;
  enableAnalytics: boolean;
}

// WebSocket and real-time events
export type SocketMessageType = 'election_update' | 'vote_cast' | 'new_election' | 'election_ended' | 'subscribe_election' | 'unsubscribe_election';

export interface SocketMessage {
  type: SocketMessageType;
  data: any;
  timestamp: number;
}

export interface EventMap {
  'connected': () => void;
  'disconnected': () => void;
  'error': (error: Error) => void;
  'election:updated': (election: Election) => void;
  'election:created': (election: Election) => void;
  'election:ended': (election: Election) => void;
  'vote:cast': (electionId: number, candidateId: number) => void;
}

export type EventCallback<T extends keyof EventMap> = EventMap[T];

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Form Validation Types
export interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export interface FormValidationSchema {
  [fieldName: string]: FieldValidation;
}

// Security and validation types
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
}

export interface SecurityConfig {
  maxLoginAttempts: number;
  lockoutDuration: number;
  sessionTimeout: number;
  csrfTokenLength: number;
  passwordMinLength: number;
  requireSpecialChars: boolean;
  enableCSP: boolean;
  enableHSTS: boolean;
  rateLimiting: RateLimitConfig;
}

export interface CSPDirectives {
  'default-src': string[];
  'script-src': string[];
  'style-src': string[];
  'font-src': string[];
  'img-src': string[];
  'connect-src': string[];
  'frame-ancestors': string[];
  'base-uri': string[];
  'form-action': string[];
}

// PWA Types
export interface PWAInstallPrompt {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    ethereum?: any;
    web3?: any;
    deferredPrompt?: PWAInstallPrompt;
    uiManager?: any;
  }
}
