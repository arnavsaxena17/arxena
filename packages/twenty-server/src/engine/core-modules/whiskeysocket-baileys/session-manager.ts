import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { StaticGraphQLService } from '../graphql/static-graphql.service';
import { MessageQueueService } from '../message-queue/services/message-queue.service';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';
import { IEventsGateway } from './events-gateway-module/events-gateway.interface';
import { BaileysWhatsappService } from './whiskeysocket-baileys.service';

export interface SessionMetrics {
  recruiterId: string;
  recruiterName?: string;
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

  async getOrCreateSession(recruiterId: string, eventsGateway: IEventsGateway, recruiterName?: string): Promise<BaileysWhatsappService> {
    // Validate recruiterId
    if (!this.isValidRecruiterId(recruiterId)) {
      throw new Error('Invalid recruiter ID');
    }

    // Check if session exists and is active
    if (this.sessions.has(recruiterId)) {
      const session = this.sessions.get(recruiterId)!;
      const metrics = this.sessionMetrics.get(recruiterId)!;
      const recruiterName = metrics?.recruiterName || 'Unknown User';

      console.log("recruiterName in getOrCreateSession::", recruiterName);
      
      // Check if the session is actually active by verifying the socket
      const isSocketActive = session.sock?.ws?.readyState === 1; // WebSocket.OPEN
      const isSocketConnecting = session.sock?.ws?.readyState === 0; // WebSocket.CONNECTING
      
      if (this.isSessionActive(metrics) && (isSocketActive || isSocketConnecting)) {
        console.log(`Using existing active session for recruiter: ${recruiterName}`);
        this.updateSessionActivity(recruiterId);
        return session;
      } else if (this.isSessionActive(metrics)) {
        // Session is active but socket is not connected - attempt to reconnect
        console.log(`Session active but socket disconnected for recruiter: ${recruiterName}, attempting reconnection`);
        this.updateSessionActivity(recruiterId);
        
        // Check if we have valid auth files to attempt reconnection
        const hasValidCreds = this.hasValidCredentials(recruiterId);
        
        if (hasValidCreds) {
          try {
            console.log(`🔄 Attempting soft restart for recruiter: ${recruiterName} with existing credentials`);
            console.log(`📊 Session state before restart:`, {
              hasSocket: !!session.sock,
              socketState: session.sock?.ws?.readyState,
              connectionStatus: (session as any).connectionStatus,
              hasQR: !!(session as any).whatsappLoginQrString
            });
            await session.softRestart();
            console.log(`✅ Successfully reconnected session for recruiter: ${recruiterName}`);
          } catch (error) {
            console.error(`❌ Failed to reconnect session for recruiter ${recruiterName}:`, error);
            // If reconnection fails, we'll still return the session and let it handle the error
          }
        } else {
          console.log(`⚠️ No valid credentials found for recruiter: ${recruiterName}, cannot reconnect`);
        }
        
        return session;
      } else {
        console.log(`Cleaning up inactive session for recruiter: ${recruiterName}`);
        // Clean up inactive session
        await this.removeSession(recruiterId);
      }
    }

    // Check if we're at capacity
    if (this.sessions.size >= this.maxSessions) {
      await this.evictOldestSession();
    }

    // Create new session
    const session = new BaileysWhatsappService(
      this.workspaceQueryService,
      this.staticGraphQLService,
      this.messageQueueService
    );
    
    await session.initializeSession(recruiterId, eventsGateway, recruiterName);
    
    this.sessions.set(recruiterId, session);
    this.sessionMetrics.set(recruiterId, {
      recruiterId,
      recruiterName: recruiterName || 'Unknown User',
      lastActivity: Date.now(),
      connectionCount: 1,
      isActive: true,
      memoryUsage: this.estimateMemoryUsage(session),
      isRegistered: true,
      hasAuthFiles: fs.existsSync(`baileys_auth_info/${recruiterId}`),
      hasWebSocketConnection: true,
      whatsappConnectionStatus: 'connecting'
    });

    console.log(`Created new WhatsApp session for recruiter: ${recruiterId}. Total sessions: ${this.sessions.size}`);
    
    return session;
  }

  async removeSession(recruiterId: string, clearAuth: boolean = false): Promise<void> {
    const session = this.sessions.get(recruiterId);
    if (session) {
      try {
        if (clearAuth) {
          await session.clearAuthAndRestart(true);
          console.log(`Cleaned up WhatsApp session and auth for recruiter: ${recruiterId}`);
        } else {
          // Just cleanup the session without clearing auth files
          await session.cleanup();
          console.log(`Cleaned up WhatsApp session (preserving auth) for recruiter: ${recruiterId}`);
        }
      } catch (error) {
        console.error(`Error cleaning up session for recruiter ${recruiterId}:`, error);
      }
    }
    
    this.sessions.delete(recruiterId);
    this.sessionMetrics.delete(recruiterId);
  }

  async logoutSession(recruiterId: string): Promise<void> {
    console.log(`Explicit logout requested for recruiter: ${recruiterId}`);
    await this.removeSession(recruiterId, true); // Clear auth on explicit logout
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
    for (const session of registeredSessions) {
      const recruiterId = session.recruiterId;
      const recruiterName = session.recruiterName || 'Unknown User';
      const authPath = `baileys_auth_info/${recruiterId}`;
      const hasAuthFiles = fs.existsSync(authPath);
      
      allSessions.set(recruiterId, {
        recruiterId,
        recruiterName,
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

  getRegisteredSessions(): Array<{recruiterId: string, recruiterName?: string}> {
    const filePath = './sessionIds.json';
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        // Handle backward compatibility - if it's an array of strings, convert to new format
        if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'string') {
          return data.map(id => ({ recruiterId: id, recruiterName: 'Unknown User' }));
        }
        return data;
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
    const recruiterName = metrics?.recruiterName || 'Unknown User';
    console.log(`🔍 Updating session connection status for recruiter ${recruiterId} (${recruiterName})`);
    if (!metrics) return;

    // Check BAILEYS WebSocket connection status (only baileys-socket connections)
    const recruiterRoom = `baileys-recruiter-${recruiterId}`;
    const room = await eventsGateway.getServer().in(recruiterRoom).allSockets();
    const hasWebSocketConnection = room.size > 0;
    console.log(`🔍 Checking BAILEYS-SOCKET connections for recruiter ${recruiterName}: ${room.size} clients in room ${recruiterRoom}`);

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

    // Update metrics (only based on BAILEYS-SOCKET connections, not general-socket)
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

  private hasValidCredentials(recruiterId: string): boolean {
    const authPath = `baileys_auth_info/${recruiterId}`;
    if (!fs.existsSync(authPath)) {
      return false;
    }
    
    // Check for required auth files
    const requiredFiles = ['creds.json', 'keys.json'];
    for (const file of requiredFiles) {
      const filePath = `${authPath}/${file}`;
      if (!fs.existsSync(filePath)) {
        return false;
      }
      
      // Check if file has content
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (!content || content.trim() === '' || content === '{}') {
          return false;
        }
      } catch (error) {
        return false;
      }
    }
    
    return true;
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
    const GRACE_PERIOD_MS = 600000; // 10 minutes grace period before clearing auth

    for (const [recruiterId, metrics] of this.sessionMetrics) {
      if (!this.isSessionActive(metrics)) {
        // Check if session has been inactive for longer than grace period
        const timeSinceLastActivity = now - metrics.lastActivity;
        if (timeSinceLastActivity > GRACE_PERIOD_MS) {
          console.log(`Session for recruiter ${recruiterId} (${metrics.recruiterName }) has been inactive for ${Math.round(timeSinceLastActivity / 60000)} minutes, marking for cleanup`);
          sessionsToRemove.push(recruiterId);
        } else {
          console.log(`Session for recruiter ${recruiterId} (${metrics.recruiterName }) is inactive but within grace period (${Math.round((GRACE_PERIOD_MS - timeSinceLastActivity) / 60000)} minutes remaining)`);
        }
      }
    }

    for (const recruiterId of sessionsToRemove) {
      await this.removeSession(recruiterId);
    }

    if (sessionsToRemove.length > 0) {
      console.log(`Cleaned up ${sessionsToRemove.length} inactive sessions after grace period`);
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