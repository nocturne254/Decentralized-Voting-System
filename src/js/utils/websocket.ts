// Real-time WebSocket communication for live updates
import { logger } from './logger';
import type { SocketMessage, EventMap, EventCallback } from '@/types';

export class WebSocketManager {
  private static instance: WebSocketManager;
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners = new Map<keyof EventMap, Set<EventCallback<any>>>();
  private isConnecting = false;
  private url: string;

  private constructor() {
    this.url = this.getWebSocketUrl();
  }

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws`;
  }

  async connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      this.socket = new WebSocket(this.url);
      
      this.socket.onopen = () => {
        logger.info('WebSocket connected', 'WEBSOCKET');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.emit('connected');
      };

      this.socket.onmessage = (event) => {
        try {
          const message: SocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          logger.error('Failed to parse WebSocket message', 'WEBSOCKET', { data: event.data });
        }
      };

      this.socket.onclose = (event) => {
        logger.warn('WebSocket disconnected', 'WEBSOCKET', { 
          code: event.code, 
          reason: event.reason 
        });
        this.isConnecting = false;
        this.emit('disconnected');
        this.handleReconnect();
      };

      this.socket.onerror = (error) => {
        logger.error('WebSocket error', 'WEBSOCKET', error);
        this.isConnecting = false;
        const errorObj = new Error('WebSocket connection error');
        this.emit('error', errorObj);
      };

    } catch (error) {
      this.isConnecting = false;
      logger.error('Failed to create WebSocket connection', 'WEBSOCKET', error);
      throw error;
    }
  }

  private handleMessage(message: SocketMessage): void {
    logger.debug('Received WebSocket message', 'WEBSOCKET', message);

    switch (message.type) {
      case 'election_update':
        this.emit('election:updated', message.data);
        break;
      case 'vote_cast':
        this.emit('vote:cast', message.data.electionId, message.data.candidateId);
        break;
      case 'new_election':
        this.emit('election:created', message.data);
        break;
      case 'election_ended':
        this.emit('election:ended', message.data);
        break;
      default:
        logger.warn('Unknown WebSocket message type', 'WEBSOCKET', { type: message.type });
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached', 'WEBSOCKET');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    logger.info(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`, 'WEBSOCKET');

    setTimeout(() => {
      this.connect().catch(error => {
        logger.error('Reconnection failed', 'WEBSOCKET', error);
      });
    }, delay);
  }

  send(message: Partial<SocketMessage>): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      const fullMessage: SocketMessage = {
        type: message.type!,
        data: message.data,
        timestamp: Date.now(),
      };
      
      this.socket.send(JSON.stringify(fullMessage));
      logger.debug('Sent WebSocket message', 'WEBSOCKET', fullMessage);
    } else {
      logger.warn('Cannot send message: WebSocket not connected', 'WEBSOCKET');
    }
  }

  on<T extends keyof EventMap>(event: T, callback: EventCallback<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off<T extends keyof EventMap>(event: T, callback: EventCallback<T>): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  private emit<T extends keyof EventMap>(event: T, ...args: Parameters<EventCallback<T>>): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          (callback as any)(...args);
        } catch (error) {
          logger.error(`Error in WebSocket event listener for ${event}`, 'WEBSOCKET', error);
        }
      });
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  getConnectionState(): string {
    if (!this.socket) return 'DISCONNECTED';
    
    switch (this.socket.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'CONNECTED';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'DISCONNECTED';
      default:
        return 'UNKNOWN';
    }
  }
}

// Real-time election updates
export class ElectionUpdates {
  private wsManager: WebSocketManager;
  private subscribedElections = new Set<number>();

  constructor() {
    this.wsManager = WebSocketManager.getInstance();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.wsManager.on('election:updated', (election) => {
      this.handleElectionUpdate(election);
    });

    this.wsManager.on('vote:cast', (electionId, candidateId) => {
      this.handleVoteCast(electionId, candidateId);
    });

    this.wsManager.on('election:created', (election) => {
      this.handleNewElection(election);
    });

    this.wsManager.on('election:ended', (election) => {
      this.handleElectionEnded(election);
    });
  }

  async subscribeToElection(electionId: number): Promise<void> {
    if (!this.subscribedElections.has(electionId)) {
      this.subscribedElections.add(electionId);
      
      this.wsManager.send({
        type: 'subscribe_election',
        data: { electionId }
      });

      logger.info(`Subscribed to election updates: ${electionId}`, 'ELECTION_UPDATES');
    }
  }

  unsubscribeFromElection(electionId: number): void {
    if (this.subscribedElections.has(electionId)) {
      this.subscribedElections.delete(electionId);
      
      this.wsManager.send({
        type: 'unsubscribe_election',
        data: { electionId }
      });

      logger.info(`Unsubscribed from election updates: ${electionId}`, 'ELECTION_UPDATES');
    }
  }

  private handleElectionUpdate(election: any): void {
    logger.info('Election updated', 'ELECTION_UPDATES', { electionId: election.id });
    
    // Update UI elements
    this.updateElectionCard(election);
    this.updateStatistics();
  }

  private handleVoteCast(electionId: number, candidateId: number): void {
    logger.info('Vote cast', 'ELECTION_UPDATES', { electionId, candidateId });
    
    // Update vote counts in real-time
    this.updateVoteCount(electionId, candidateId);
    this.showVoteNotification(electionId);
  }

  private handleNewElection(election: any): void {
    logger.info('New election created', 'ELECTION_UPDATES', { electionId: election.id });
    
    // Add new election to the list
    this.addElectionToList(election);
    this.showNewElectionNotification(election);
  }

  private handleElectionEnded(election: any): void {
    logger.info('Election ended', 'ELECTION_UPDATES', { electionId: election.id });
    
    // Update election status
    this.markElectionAsEnded(election);
    this.showElectionEndedNotification(election);
  }

  private updateElectionCard(election: any): void {
    const electionCard = document.querySelector(`[data-election-id="${election.id}"]`);
    if (electionCard) {
      // Update election data in the DOM
      const statusElement = electionCard.querySelector('.election-status');
      const candidatesElement = electionCard.querySelector('.candidates-list');
      
      if (statusElement && election.status) {
        statusElement.textContent = election.status;
        statusElement.className = `election-status status-${election.status.toLowerCase()}`;
      }

      if (candidatesElement && election.candidates) {
        this.updateCandidatesList(candidatesElement, election.candidates);
      }
    }
  }

  private updateCandidatesList(container: Element, candidates: any[]): void {
    candidates.forEach(candidate => {
      const candidateElement = container.querySelector(`[data-candidate-id="${candidate.id}"]`);
      if (candidateElement) {
        const voteCountElement = candidateElement.querySelector('.candidate-votes');
        if (voteCountElement) {
          voteCountElement.textContent = `${candidate.voteCount} votes`;
        }
      }
    });
  }

  private updateVoteCount(electionId: number, candidateId: number): void {
    const candidateElement = document.querySelector(
      `[data-election-id="${electionId}"] [data-candidate-id="${candidateId}"] .candidate-votes`
    );
    
    if (candidateElement) {
      const currentCount = parseInt(candidateElement.textContent || '0');
      candidateElement.textContent = `${currentCount + 1} votes`;
      
      // Add visual feedback
      candidateElement.classList.add('vote-updated');
      setTimeout(() => {
        candidateElement.classList.remove('vote-updated');
      }, 2000);
    }
  }

  private updateStatistics(): void {
    // Trigger statistics refresh if on admin page
    if (window.location.pathname.includes('admin')) {
      const event = new CustomEvent('refreshStatistics');
      document.dispatchEvent(event);
    }
  }

  private addElectionToList(election: any): void {
    const electionsList = document.getElementById('electionsList');
    if (electionsList) {
      // Create new election card and prepend to list
      const event = new CustomEvent('newElectionCreated', { detail: election });
      document.dispatchEvent(event);
    }
  }

  private markElectionAsEnded(election: any): void {
    const electionCard = document.querySelector(`[data-election-id="${election.id}"]`);
    if (electionCard) {
      electionCard.classList.add('election-ended');
      
      const statusElement = electionCard.querySelector('.election-status');
      if (statusElement) {
        statusElement.textContent = 'Ended';
        statusElement.className = 'election-status status-ended';
      }
    }
  }

  private showVoteNotification(_electionId: number): void {
    if (window.uiManager) {
      window.uiManager.showNotification('A new vote was cast!', 'info', { duration: 3000 });
    }
  }

  private showNewElectionNotification(election: any): void {
    if (window.uiManager) {
      window.uiManager.showNotification(`New election created: ${election.name}`, 'info', { duration: 5000 });
    }
  }

  private showElectionEndedNotification(election: any): void {
    if (window.uiManager) {
      window.uiManager.showNotification(`Election ended: ${election.name}`, 'warning', { duration: 5000 });
    }
  }
}

// Initialize WebSocket connection
export const wsManager = WebSocketManager.getInstance();
export const electionUpdates = new ElectionUpdates();
