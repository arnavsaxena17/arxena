import { useLazyQuery } from '@apollo/client';
import styled from '@emotion/styled';
import { useEffect, useState } from 'react';
import {
    Button,
    Card,
    CardContent,
    H2Title,
    IconRefresh,
    Section,
    Status
} from 'twenty-ui';
import { GET_WHATSAPP_HEALTH_STATUS, GET_WHATSAPP_SESSION_STATS } from '../graphql/queries/getWhatsAppHealthStatus';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
`;

const StyledCardsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledSessionCard = styled(Card)`
  border: ${({ theme }) => `1px solid ${theme.border.color.light}`};
`;

const StyledSessionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledSessionInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledSessionActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledMetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(2)};
`;

const StyledMetricItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledMetricLabel = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledMetricValue = styled.span`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledErrorMessage = styled.div`
  color: ${({ theme }) => theme.color.red};
  padding: ${({ theme }) => theme.spacing(2)};
  background: ${({ theme }) => theme.background.transparent.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
`;

const StyledUnavailableMessage = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  padding: ${({ theme }) => theme.spacing(3)};
  background: ${({ theme }) => theme.background.transparent.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledLoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledCardHeader = styled.div`
  padding: ${({ theme }) => theme.spacing(3)};
  border-bottom: ${({ theme }) => `1px solid ${theme.border.color.light}`};
`;

const StyledCardTitle = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledProgressBar = styled.div<{ value: number; color: string }>`
  width: 100%;
  height: 8px;
  background: ${({ theme }) => theme.border.color.medium};
  border-radius: 4px;
  overflow: hidden;
  margin: ${({ theme }) => theme.spacing(2)} 0;
  
  &::after {
    content: '';
    display: block;
    width: ${({ value }) => value}%;
    height: 100%;
    background: ${({ color }) => 
      color === 'green' ? '#10b981' : 
      color === 'yellow' ? '#f59e0b' : 
      '#ef4444'
    };
    transition: width 0.3s ease;
  }
`;

const StyledBadge = styled.span<{ variant?: 'secondary' | 'outline' }>`
  display: inline-flex;
  align-items: center;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ variant, theme }) => 
    variant === 'outline' ? 'transparent' : theme.background.transparent.light
  };
  border: ${({ variant, theme }) => 
    variant === 'outline' ? `1px solid ${theme.border.color.medium}` : 'none'
  };
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const WHATSAPP_MODULE_UNAVAILABLE_MESSAGE =
  'WhatsApp monitoring is not available because the module is not loaded.';

const isWhatsAppModuleUnavailableError = (message: string): boolean =>
  (message.includes('getWhatsAppSessionStats') || message.includes('getWhatsAppHealthStatus')) &&
  message.includes('on type') &&
  message.includes('Query');

export const SettingsAdminWhatsAppMonitoring = () => {
  const [healthData, setHealthData] = useState<any>(null);
  const [statsData, setStatsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [getWhatsAppHealthStatus] = useLazyQuery(GET_WHATSAPP_HEALTH_STATUS, {
    onCompleted: (data) => {
      setHealthData(data);
    },
    onError: (error) => {
      setError(error.message);
    }
  });

  const [getWhatsAppSessionStats] = useLazyQuery(GET_WHATSAPP_SESSION_STATS, {
    onCompleted: (data) => {
      setStatsData(data);
    },
    onError: (error) => {
      setError(error.message);
    }
  });

  const fetchWhatsAppHealth = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch both queries in parallel
      await Promise.all([
        getWhatsAppHealthStatus(),
        getWhatsAppSessionStats()
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWhatsAppHealth();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchWhatsAppHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const refreshData = () => {
    fetchWhatsAppHealth();
  };

  const formatLastActivity = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getSessionStatusColor = (session: any) => {
    if (session.isActive && session.hasWebSocketConnection && session.whatsappConnectionStatus === 'connected') {
      return 'green';
    } else if (session.hasWebSocketConnection || session.whatsappConnectionStatus === 'connecting') {
      return 'yellow';
    } else {
      return 'red';
    }
  };

  const getSessionStatusText = (session: any) => {
    if (session.isActive && session.hasWebSocketConnection && session.whatsappConnectionStatus === 'connected') {
      return 'Fully Connected';
    } else if (session.hasWebSocketConnection && session.whatsappConnectionStatus === 'connecting') {
      return 'Connecting';
    } else if (session.hasWebSocketConnection) {
      return 'WebSocket Only';
    } else if (session.whatsappConnectionStatus === 'connected') {
      return 'WhatsApp Only';
    } else {
      return 'Disconnected';
    }
  };

  if (loading && !healthData?.getWhatsAppHealthStatus) {
    return (
      <StyledLoadingSpinner>
        <div>Loading WhatsApp monitoring data...</div>
      </StyledLoadingSpinner>
    );
  }

  if (error) {
    const moduleUnavailable = isWhatsAppModuleUnavailableError(error);
    if (moduleUnavailable) {
      return (
        <StyledUnavailableMessage>
          {WHATSAPP_MODULE_UNAVAILABLE_MESSAGE}
          <Button onClick={refreshData} variant="secondary" size="small">
            <IconRefresh size={16} />
            Retry
          </Button>
        </StyledUnavailableMessage>
      );
    }
    return (
      <StyledErrorMessage>
        Error loading WhatsApp monitoring data: {error}
        <Button onClick={refreshData} variant="secondary" size="small">
          <IconRefresh size={16} />
          Retry
        </Button>
      </StyledErrorMessage>
    );
  }

  return (
    <StyledContainer>
      <Section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <H2Title title="WhatsApp Session Monitoring" />
          <Button onClick={refreshData} variant="secondary" size="small">
            <IconRefresh size={16} />
            Refresh
          </Button>
        </div>

        {/* Overall Health Status */}
        <StyledCardsGrid>
          <Card>
            <StyledCardHeader>
              <StyledCardTitle>System Status</StyledCardTitle>
            </StyledCardHeader>
            <CardContent>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Status 
                  color={healthData?.getWhatsAppHealthStatus?.status === 'healthy' ? 'green' : 'red'} 
                  text={healthData?.getWhatsAppHealthStatus?.status === 'healthy' ? 'Healthy' : 'Unhealthy'} 
                  weight="medium" 
                />
                <span style={{ fontSize: '14px', color: '#666' }}>
                  Last updated: {healthData?.getWhatsAppHealthStatus?.timestamp ? new Date(healthData.getWhatsAppHealthStatus.timestamp).toLocaleTimeString() : 'Never'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <StyledCardHeader>
              <StyledCardTitle>Session Overview</StyledCardTitle>
            </StyledCardHeader>
            <CardContent>
              <StyledMetricsGrid>
                <StyledMetricItem>
                  <StyledMetricLabel>Registered Sessions</StyledMetricLabel>
                  <StyledMetricValue>{statsData?.getWhatsAppSessionStats?.registeredSessions || 0}</StyledMetricValue>
                </StyledMetricItem>
                <StyledMetricItem>
                  <StyledMetricLabel>Active Sessions</StyledMetricLabel>
                  <StyledMetricValue>{statsData?.getWhatsAppSessionStats?.activeSessions || 0}</StyledMetricValue>
                </StyledMetricItem>
                <StyledMetricItem>
                  <StyledMetricLabel>Inactive Sessions</StyledMetricLabel>
                  <StyledMetricValue>{statsData?.getWhatsAppSessionStats?.inactiveSessions || 0}</StyledMetricValue>
                </StyledMetricItem>
                <StyledMetricItem>
                  <StyledMetricLabel>Memory Usage</StyledMetricLabel>
                  <StyledMetricValue>{statsData?.getWhatsAppSessionStats?.totalMemoryUsageMB || 0} MB</StyledMetricValue>
                </StyledMetricItem>
                <StyledMetricItem>
                  <StyledMetricLabel>Efficiency</StyledMetricLabel>
                  <StyledMetricValue>{Math.round(statsData?.getWhatsAppSessionStats?.memoryEfficiency || 0)}%</StyledMetricValue>
                </StyledMetricItem>
              </StyledMetricsGrid>
            </CardContent>
          </Card>
        </StyledCardsGrid>

        {/* Session Progress */}
        {statsData?.getWhatsAppSessionStats && (
          <Card style={{ marginTop: '16px' }}>
            <StyledCardHeader>
              <StyledCardTitle>Session Efficiency</StyledCardTitle>
            </StyledCardHeader>
            <CardContent>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: '14px' }}>
                  {statsData.getWhatsAppSessionStats.activeSessions} of {statsData.getWhatsAppSessionStats.totalSessions} sessions active
                </span>
              </div>
              <StyledProgressBar 
                value={statsData.getWhatsAppSessionStats.totalSessions > 0 ? (statsData.getWhatsAppSessionStats.activeSessions / statsData.getWhatsAppSessionStats.totalSessions) * 100 : 0} 
                color={statsData.getWhatsAppSessionStats.memoryEfficiency > 80 ? 'green' : statsData.getWhatsAppSessionStats.memoryEfficiency > 60 ? 'yellow' : 'red'}
              />
            </CardContent>
          </Card>
        )}

        {/* Individual Sessions */}
        {healthData?.getWhatsAppHealthStatus?.metrics && healthData.getWhatsAppHealthStatus.metrics.length > 0 && (
          <Card style={{ marginTop: '16px' }}>
            <StyledCardHeader>
              <StyledCardTitle>All Sessions</StyledCardTitle>
            </StyledCardHeader>
            <CardContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {healthData.getWhatsAppHealthStatus.metrics.map((session: any) => (
                  <StyledSessionCard key={session.recruiterId}>
                    <CardContent>
                      <StyledSessionHeader>
                        <StyledSessionInfo>
                          <div style={{ fontWeight: '600' }}>
                            Recruiter: {session.recruiterId}
                          </div>
                          <div style={{ fontSize: '14px', color: '#666' }}>
                            {session.isActive ? `Last activity: ${formatLastActivity(session.lastActivity)}` : 'Not active'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#888' }}>
                            {session.isRegistered ? '✓ Registered' : '✗ Not registered'} • 
                            {session.hasAuthFiles ? ' ✓ Auth files' : ' ✗ No auth files'} • 
                            {session.hasWebSocketConnection ? ' ✓ WebSocket' : ' ✗ No WebSocket'} • 
                            WhatsApp: {session.whatsappConnectionStatus}
                          </div>
                        </StyledSessionInfo>
                        <StyledSessionActions>
                          <Status 
                            color={getSessionStatusColor(session)} 
                            text={getSessionStatusText(session)} 
                            weight="medium" 
                          />
                          {session.isActive && (
                            <>
                              <StyledBadge variant="secondary">
                                {session.connectionCount} connections
                              </StyledBadge>
                              <StyledBadge variant="outline">
                                {session.memoryUsageMB} MB
                              </StyledBadge>
                            </>
                          )}
                        </StyledSessionActions>
                      </StyledSessionHeader>
                    </CardContent>
                  </StyledSessionCard>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Sessions Message */}
        {healthData?.getWhatsAppHealthStatus?.metrics && healthData.getWhatsAppHealthStatus.metrics.length === 0 && (
          <Card style={{ marginTop: '16px' }}>
            <CardContent>
              <div style={{ textAlign: 'center', padding: '32px', color: '#666' }}>
                No WhatsApp sessions found
              </div>
            </CardContent>
          </Card>
        )}
      </Section>
    </StyledContainer>
  );
};
