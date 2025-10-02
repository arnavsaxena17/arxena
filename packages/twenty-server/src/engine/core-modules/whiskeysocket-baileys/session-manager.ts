import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { StaticGraphQLService } from '../graphql/static-graphql.service';
import { MessageQueueService } from '../message-queue/services/message-queue.service';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';
import { IEventsGateway } from './events-gateway-module/events-gateway.interface';
import { BaileysWhatsappService } from './whiskeysocket-baileys.service';

export interface SessionMetrics {
  recruiterId: string;
  lastActivity: number;
  connectionCount: number;
  isActive: boolean;
  memoryUsage: number;
  isRegistered: boolean;
  hasAuthFiles: boolean;
  hasWebSocketConnection: boolean;
  whatsappConnectionStatus: string;
}

@Injectable()
export class WhatsAppSessionManager {
  private sessions: Map<string, BaileysWhatsappService> = new Map();
  private sessionMetrics: Map<string, SessionMetrics> = new Map();
  private readonly maxSessions: number;
  private readonly sessionTimeout: number;
  private readonly maxConnectionsPerSession: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly messageQueueService: MessageQueueService,
    maxSessions: number = 50, // Configurable limit
    sessionTimeout: number = 300000, // 5 minutes
    maxConnectionsPerSession: number = 3
  ) {
    this.maxSessions = maxSessions;
    this.sessionTimeout = sessionTimeout;
    this.maxConnectionsPerSession = maxConnectionsPerSession;
    this.startCleanupInterval();
  }

  async getOrCreateSession(recruiterId: string, eventsGateway: IEventsGateway): Promise<BaileysWhatsappService> {
    // Validate recruiterId
    if (!this.isValidRecruiterId(recruiterId)) {
      throw new Error('Invalid recruiter ID');
    }

    // Check if session exists and is active
    if (this.sessions.has(recruiterId)) {
      const session = this.sessions.get(recruiterId)!;
      const metrics = this.sessionMetrics.get(recruiterId)!;
      
      if (this.isSessionActive(metrics)) {
        this.updateSessionActivity(recruiterId);
        console.log(`Returning existing active session for recruiter: ${recruiterId}`);
        return session;
      } else {
        // Clean up inactive session
        console.log(`Cleaning up inactive session for recruiter: ${recruiterId}`);
        await this.removeSession(recruiterId);
      }
    }

    // Check if we're at capacity
    if (this.sessions.size >= this.maxSessions) {
      await this.evictOldestSession();
    }

    // Create new session
    console.log(`Creating new WhatsApp session for recruiter: ${recruiterId}`);
    const session = new BaileysWhatsappService(
      this.workspaceQueryService,
      this.staticGraphQLService,
      this.messageQueueService
    );
    
    // Set the session in the map before initialization to prevent race conditions
    this.sessions.set(recruiterId, session);
    this.sessionMetrics.set(recruiterId, {
      recruiterId,
      lastActivity: Date.now(),
      connectionCount: 1,
      isActive: false, // Set to false initially, will be updated after successful connection
      memoryUsage: this.estimateMemoryUsage(session),
      isRegistered: true,
      hasAuthFiles: fs.existsSync(`baileys_auth_info/${recruiterId}`),
      hasWebSocketConnection: true,
      whatsappConnectionStatus: 'connecting'
    });

    try {
      await session.initializeSession(recruiterId, eventsGateway);
      console.log(`Successfully initialized WhatsApp session for recruiter: ${recruiterId}. Total sessions: ${this.sessions.size}`);
    } catch (error) {
      console.error(`Failed to initialize session for recruiter ${recruiterId}:`, error);
      // Remove the failed session
      this.sessions.delete(recruiterId);
      this.sessionMetrics.delete(recruiterId);
      throw error;
    }
    
    return session;
  }

  async removeSession(recruiterId: string): Promise<void> {
    const session = this.sessions.get(recruiterId);
    if (session) {
      try {
        await session.clearAuthAndRestart(true);
        console.log(`Cleaned up WhatsApp session for recruiter: ${recruiterId}`);
      } catch (error) {
        console.error(`Error cleaning up session for recruiter ${recruiterId}:`, error);
      }
    }
    
    this.sessions.delete(recruiterId);
    this.sessionMetrics.delete(recruiterId);
  }

  getSession(recruiterId: string): BaileysWhatsappService | undefined {
    return this.sessions.get(recruiterId);
  }

  hasSession(recruiterId: string): boolean {
    return this.sessions.has(recruiterId);
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getActiveSessionCount(): number {
    let count = 0;
    for (const metrics of this.sessionMetrics.values()) {
      if (this.isSessionActive(metrics)) {
        count++;
      }
    }
    return count;
  }

  async getSessionMetrics(eventsGateway?: IEventsGateway): Promise<SessionMetrics[]> {
    // Get all registered sessions from sessionIds.json
    const registeredSessions = this.getRegisteredSessions();
    
    // Create a map of all sessions (registered + active)
    const allSessions = new Map<string, SessionMetrics>();
    
    // Add registered sessions
    for (const recruiterId of registeredSessions) {
      const authPath = `baileys_auth_info/${recruiterId}`;
      const hasAuthFiles = fs.existsSync(authPath);
      
      allSessions.set(recruiterId, {
        recruiterId,
        lastActivity: 0,
        connectionCount: 0,
        isActive: false,
        memoryUsage: 0,
        isRegistered: true,
        hasAuthFiles,
        hasWebSocketConnection: false,
        whatsappConnectionStatus: 'disconnected'
      });
    }
    
    // Update with active session data
    for (const [recruiterId, metrics] of this.sessionMetrics) {
      allSessions.set(recruiterId, {
        ...metrics,
        isRegistered: true,
        hasAuthFiles: fs.existsSync(`baileys_auth_info/${recruiterId}`)
      });
    }
    
    // Update connection status for all sessions if eventsGateway is provided
    if (eventsGateway) {
      for (const [recruiterId, metrics] of allSessions) {
        await this.updateSessionConnectionStatus(recruiterId, eventsGateway);
        // Update the metrics with the latest connection status
        const updatedMetrics = this.sessionMetrics.get(recruiterId);
        if (updatedMetrics) {
          allSessions.set(recruiterId, {
            ...metrics,
            ...updatedMetrics
          });
        }
      }
    }
    
    return Array.from(allSessions.values());
  }

  getRegisteredSessions(): string[] {
    const filePath = './sessionIds.json';
    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (error) {
        console.error('Error reading sessionIds.json:', error);
        return [];
      }
    }
    return [];
  }

  getRegisteredSessionCount(): number {
    return this.getRegisteredSessions().length;
  }

  async updateSessionConnectionStatus(recruiterId: string, eventsGateway: IEventsGateway): Promise<void> {
    const metrics = this.sessionMetrics.get(recruiterId);
    if (!metrics) return;

    // Check WebSocket connection status
    const recruiterRoom = `recruiter-${recruiterId}`;
    const room = await eventsGateway.getServer().in(recruiterRoom).allSockets();
    const hasWebSocketConnection = room.size > 0;

    // Get WhatsApp connection status
    const session = this.sessions.get(recruiterId);
    let whatsappConnectionStatus = 'disconnected';
    if (session) {
      // Check if the WhatsApp service has an active connection
      const sock = (session as any).sock;
      if (sock && sock.ws && sock.ws.readyState === 1) { // WebSocket.OPEN
        whatsappConnectionStatus = 'connected';
      } else if (sock && sock.ws && sock.ws.readyState === 0) { // WebSocket.CONNECTING
        whatsappConnectionStatus = 'connecting';
      } else {
        whatsappConnectionStatus = 'disconnected';
      }
    }

    // Update metrics
    metrics.hasWebSocketConnection = hasWebSocketConnection;
    metrics.whatsappConnectionStatus = whatsappConnectionStatus;
    metrics.isActive = hasWebSocketConnection && whatsappConnectionStatus === 'connected';
    metrics.connectionCount = room.size;
    
    if (hasWebSocketConnection) {
      metrics.lastActivity = Date.now();
    }
  }

  private isValidRecruiterId(recruiterId: string): boolean {
    return Boolean(recruiterId && 
           typeof recruiterId === 'string' && 
           recruiterId !== 'undefined' && 
           recruiterId.length > 0);
  }

  private isSessionActive(metrics: SessionMetrics): boolean {
    return Boolean(metrics.isActive) && 
           (Date.now() - metrics.lastActivity) < this.sessionTimeout;
  }

  private updateSessionActivity(recruiterId: string): void {
    const metrics = this.sessionMetrics.get(recruiterId);
    if (metrics) {
      metrics.lastActivity = Date.now();
      metrics.isActive = true;
    }
  }

  private async evictOldestSession(): Promise<void> {
    let oldestRecruiterId: string | null = null;
    let oldestTime = Date.now();

    for (const [recruiterId, metrics] of this.sessionMetrics) {
      if (metrics.lastActivity < oldestTime) {
        oldestTime = metrics.lastActivity;
        oldestRecruiterId = recruiterId;
      }
    }

    if (oldestRecruiterId) {
      console.log(`Evicting oldest session for recruiter: ${oldestRecruiterId}`);
      await this.removeSession(oldestRecruiterId);
    }
  }

  private estimateMemoryUsage(session: BaileysWhatsappService): number {
    // Rough estimation of memory usage per session
    // This would need to be refined based on actual measurements
    return 50 * 1024 * 1024; // 50MB per session estimate
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupInactiveSessions();
    }, 60000); // Run cleanup every minute
  }

  private async cleanupInactiveSessions(): Promise<void> {
    const now = Date.now();
    const sessionsToRemove: string[] = [];

    for (const [recruiterId, metrics] of this.sessionMetrics) {
      if (!this.isSessionActive(metrics)) {
        sessionsToRemove.push(recruiterId);
      }
    }

    for (const recruiterId of sessionsToRemove) {
      await this.removeSession(recruiterId);
    }

    if (sessionsToRemove.length > 0) {
      console.log(`Cleaned up ${sessionsToRemove.length} inactive sessions`);
    }
  }

  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Clean up all sessions
    const sessionIds = Array.from(this.sessions.keys());
    for (const recruiterId of sessionIds) {
      await this.removeSession(recruiterId);
    }

    console.log('WhatsApp Session Manager shutdown complete');
  }
}
