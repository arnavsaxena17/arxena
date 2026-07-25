import { gql } from '@apollo/client';

export const GET_LINKEDIN_UNIPILE_HEALTH_STATUS = gql`
  query GetLinkedInUnipileHealthStatus {
    getLinkedInUnipileHealthStatus {
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
        linkedinConnectionStatus
      }
    }
  }
`;

export const GET_LINKEDIN_UNIPILE_SESSION_STATS = gql`
  query GetLinkedInUnipileSessionStats {
    getLinkedInUnipileSessionStats {
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
