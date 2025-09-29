import { gql } from '@apollo/client';

export const GET_WHATSAPP_HEALTH_STATUS = gql`
  query GetWhatsAppHealthStatus {
    getWhatsAppHealthStatus {
      status
      timestamp
      sessions {
        total
        active
        inactive
      }
      metrics {
        recruiterId
        lastActivity
        connectionCount
        isActive
        memoryUsageMB
        isRegistered
        hasAuthFiles
        hasWebSocketConnection
        whatsappConnectionStatus
      }
    }
  }
`;

export const GET_WHATSAPP_SESSION_STATS = gql`
  query GetWhatsAppSessionStats {
    getWhatsAppSessionStats {
      totalSessions
      activeSessions
      inactiveSessions
      registeredSessions
      totalMemoryUsageMB
      averageMemoryPerSessionMB
      memoryEfficiency
    }
  }
`;

export const GET_WHATSAPP_SESSIONS = gql`
  query GetWhatsAppSessions {
    getWhatsAppSessions {
      sessions {
        recruiterId
        lastActivity
        connectionCount
        isActive
        uptime
        memoryUsageMB
        isRegistered
        hasAuthFiles
        hasWebSocketConnection
        whatsappConnectionStatus
      }
    }
  }
`;
