export interface WhatsAppConfig {
  maxSessions: number;
  sessionTimeout: number;
  maxConnectionsPerSession: number;
  cleanupInterval: number;
  enableMonitoring: boolean;
  enableRedis: boolean;
  redisUrl?: string;
  proxyUrl?: string;
}

export const getWhatsAppConfig = (): WhatsAppConfig => {
  return {
    maxSessions: parseInt(process.env.WHATSAPP_MAX_SESSIONS || '50'),
    sessionTimeout: parseInt(process.env.WHATSAPP_SESSION_TIMEOUT || '300000'), // 5 minutes
    maxConnectionsPerSession: parseInt(process.env.WHATSAPP_MAX_CONNECTIONS_PER_SESSION || '3'),
    cleanupInterval: parseInt(process.env.WHATSAPP_CLEANUP_INTERVAL || '60000'), // 1 minute
    enableMonitoring: process.env.WHATSAPP_ENABLE_MONITORING === 'true',
    enableRedis: process.env.WHATSAPP_ENABLE_REDIS === 'true',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    proxyUrl: process.env.SMART_PROXY_URL
  };
};
