import { SocksProxyAgent } from 'socks-proxy-agent';

export interface ProxySession {
  sessionId: number;
  proxyUrl: string;
  agent: SocksProxyAgent;
  isActive: boolean;
  lastUsed: number;
  failureCount: number;
}

export class ProxyRotationManager {
  private static instance: ProxyRotationManager;
  private sessions: ProxySession[] = [];
  private currentSessionIndex: number = 0;
  private baseProxyUrl: string = '';
  private maxFailuresPerSession: number = 3;
  private sessionCooldownMs: number = 30000; // 30 seconds cooldown after failure

  private constructor() {
    this.initializeSessions();
  }

  public static getInstance(): ProxyRotationManager {
    if (!ProxyRotationManager.instance) {
      ProxyRotationManager.instance = new ProxyRotationManager();
    }
    return ProxyRotationManager.instance;
  }

  private initializeSessions(): void {
    const baseUrl = process.env.SMART_PROXY_URL;
    if (!baseUrl) {
      console.log('No SMART_PROXY_URL configured, proxy rotation disabled');
      return;
    }

    this.baseProxyUrl = baseUrl;
    
    // Extract the base proxy URL without session number
    const urlParts = baseUrl.split('session-');
    if (urlParts.length !== 2) {
      console.error('Invalid proxy URL format. Expected format: socks5h://user-xxx-session-X-country-in:password@gate.decodo.com:7000');
      return;
    }

    const basePart = urlParts[0];
    const endPart = urlParts[1].substring(1); // Remove the session number

    // Create 5 sessions (session-1 to session-5)
    for (let i = 1; i <= 5; i++) {
      const sessionUrl = `${basePart}session-${i}${endPart}`;
      const agent = new SocksProxyAgent(sessionUrl);
      
      this.sessions.push({
        sessionId: i,
        proxyUrl: sessionUrl,
        agent,
        isActive: true,
        lastUsed: 0,
        failureCount: 0
      });
    }

    console.log(`Initialized ${this.sessions.length} proxy sessions`);
  }

  public getNextActiveProxy(): { agent: SocksProxyAgent; sessionId: number; proxyUrl: string } | null {
    if (this.sessions.length === 0) {
      return null;
    }

    // Filter active sessions that are not in cooldown
    const now = Date.now();
    const activeSessions = this.sessions.filter(session => 
      session.isActive && 
      (now - session.lastUsed) > this.sessionCooldownMs
    );

    if (activeSessions.length === 0) {
      console.log('No active proxy sessions available, resetting all sessions');
      this.resetAllSessions();
      return this.sessions[0] ? {
        agent: this.sessions[0].agent,
        sessionId: this.sessions[0].sessionId,
        proxyUrl: this.sessions[0].proxyUrl
      } : null;
    }

    // Get the next session in rotation
    const session = activeSessions[this.currentSessionIndex % activeSessions.length];
    this.currentSessionIndex = (this.currentSessionIndex + 1) % activeSessions.length;
    
    session.lastUsed = now;
    
    console.log(`Using proxy session-${session.sessionId} for WhatsApp connection`);
    
    return {
      agent: session.agent,
      sessionId: session.sessionId,
      proxyUrl: session.proxyUrl
    };
  }

  public markSessionFailed(sessionId: number, error?: Error): void {
    const session = this.sessions.find(s => s.sessionId === sessionId);
    if (!session) {
      console.log(`Session ${sessionId} not found for failure marking`);
      return;
    }

    session.failureCount++;
    session.lastUsed = Date.now();

    console.log(`Proxy session-${sessionId} failed (attempt ${session.failureCount}/${this.maxFailuresPerSession}):`, error?.message || 'Unknown error');

    if (session.failureCount >= this.maxFailuresPerSession) {
      session.isActive = false;
      console.log(`Proxy session-${sessionId} deactivated after ${session.failureCount} failures`);
    }
  }

  public markSessionSuccess(sessionId: number): void {
    const session = this.sessions.find(s => s.sessionId === sessionId);
    if (!session) {
      return;
    }

    // Reset failure count on success
    session.failureCount = 0;
    session.isActive = true;
    session.lastUsed = Date.now();
    
    console.log(`Proxy session-${sessionId} marked as successful`);
  }

  public resetAllSessions(): void {
    this.sessions.forEach(session => {
      session.isActive = true;
      session.failureCount = 0;
      session.lastUsed = 0;
    });
    this.currentSessionIndex = 0;
    console.log('All proxy sessions reset');
  }

  public getSessionStatus(): { sessionId: number; isActive: boolean; failureCount: number; lastUsed: number }[] {
    return this.sessions.map(session => ({
      sessionId: session.sessionId,
      isActive: session.isActive,
      failureCount: session.failureCount,
      lastUsed: session.lastUsed
    }));
  }

  public hasActiveSessions(): boolean {
    const now = Date.now();
    return this.sessions.some(session => 
      session.isActive && 
      (now - session.lastUsed) > this.sessionCooldownMs
    );
  }
}
