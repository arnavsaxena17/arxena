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
import { GET_LINKEDIN_UNIPILE_HEALTH_STATUS, GET_LINKEDIN_UNIPILE_SESSION_STATS } from '../graphql/queries/getLinkedInUnipileMonitoring';
import { GET_WHATSAPP_HEALTH_STATUS, GET_WHATSAPP_SESSION_STATS } from '../graphql/queries/getWhatsAppHealthStatus';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(6)};
`;

const StyledChannelBlock = styled.div`
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

const LINKEDIN_MODULE_UNAVAILABLE_MESSAGE =
  'LinkedIn Unipile monitoring is not available because the module is not loaded.';

const isWhatsAppModuleUnavailableError = (message: string): boolean =>
  (message.includes('getWhatsAppSessionStats') || message.includes('getWhatsAppHealthStatus')) &&
  message.includes('on type') &&
  message.includes('Query');

const isLinkedInModuleUnavailableError = (message: string): boolean =>
  (message.includes('getLinkedInUnipileSessionStats') || message.includes('getLinkedInUnipileHealthStatus')) &&
  message.includes('on type') &&
  message.includes('Query');

export const SettingsAdminWhatsAppMonitoring = () => {
  const [whatsappHealthData, setWhatsappHealthData] = useState<any>(null);
  const [whatsappStatsData, setWhatsappStatsData] = useState<any>(null);
  const [linkedinHealthData, setLinkedinHealthData] = useState<any>(null);
  const [linkedinStatsData, setLinkedinStatsData] = useState<any>(null);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [linkedinError, setLinkedinError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [loadWhatsAppHealthStatus] = useLazyQuery(GET_WHATSAPP_HEALTH_STATUS, {
    fetchPolicy: 'network-only',
  });

  const [loadWhatsAppSessionStats] = useLazyQuery(GET_WHATSAPP_SESSION_STATS, {
    fetchPolicy: 'network-only',
  });

  const [loadLinkedInUnipileHealthStatus] = useLazyQuery(GET_LINKEDIN_UNIPILE_HEALTH_STATUS, {
    fetchPolicy: 'network-only',
  });

  const [loadLinkedInUnipileSessionStats] = useLazyQuery(GET_LINKEDIN_UNIPILE_SESSION_STATS, {
    fetchPolicy: 'network-only',
  });

  const fetchMonitoringData = async () => {
    setLoading(true);
    setWhatsappError(null);
    setLinkedinError(null);
    try {
      const [healthResult, statsResult, liHealthResult, liStatsResult] = await Promise.all([
        loadWhatsAppHealthStatus(),
        loadWhatsAppSessionStats(),
        loadLinkedInUnipileHealthStatus(),
        loadLinkedInUnipileSessionStats(),
      ]);

      setWhatsappError(healthResult.error?.message ?? statsResult.error?.message ?? null);
      setWhatsappHealthData(
        healthResult.error || statsResult.error ? null : (healthResult.data ?? null),
      );
      setWhatsappStatsData(
        healthResult.error || statsResult.error ? null : (statsResult.data ?? null),
      );

      setLinkedinError(liHealthResult.error?.message ?? liStatsResult.error?.message ?? null);
      setLinkedinHealthData(
        liHealthResult.error || liStatsResult.error ? null : (liHealthResult.data ?? null),
      );
      setLinkedinStatsData(
        liHealthResult.error || liStatsResult.error ? null : (liStatsResult.data ?? null),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error occurred';
      setWhatsappError(msg);
      setLinkedinError(msg);
      setWhatsappHealthData(null);
      setWhatsappStatsData(null);
      setLinkedinHealthData(null);
      setLinkedinStatsData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
    
    const interval = setInterval(fetchMonitoringData, 30000);
    return () => clearInterval(interval);
  }, []);

  const refreshData = () => {
    fetchMonitoringData();
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

  const getWhatsAppSessionStatusColor = (session: any) => {
    if (session.isActive && session.hasWebSocketConnection && session.whatsappConnectionStatus === 'connected') {
      return 'green';
    } else if (session.hasWebSocketConnection || session.whatsappConnectionStatus === 'connecting') {
      return 'yellow';
    } else {
      return 'red';
    }
  };

  const getWhatsAppSessionStatusText = (session: any) => {
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

  const getLinkedInSessionStatusColor = (session: any) => {
    if (session.isActive && session.hasWebSocketConnection && session.linkedinConnectionStatus === 'connected') {
      return 'green';
    } else if (session.hasWebSocketConnection || session.linkedinConnectionStatus === 'connecting') {
      return 'yellow';
    } else {
      return 'red';
    }
  };

  const getLinkedInSessionStatusText = (session: any) => {
    if (session.isActive && session.hasWebSocketConnection && session.linkedinConnectionStatus === 'connected') {
      return 'Fully Connected';
    } else if (session.hasWebSocketConnection && session.linkedinConnectionStatus === 'connecting') {
      return 'Connecting';
    } else if (session.hasWebSocketConnection) {
      return 'Session Only';
    } else if (session.linkedinConnectionStatus === 'connected') {
      return 'LinkedIn Connected';
    } else {
      return 'Disconnected';
    }
  };

  if (loading && !whatsappHealthData?.getWhatsAppHealthStatus && !linkedinHealthData?.getLinkedInUnipileHealthStatus) {
    return (
      <StyledLoadingSpinner>
        <div>Loading Unipile monitoring data...</div>
      </StyledLoadingSpinner>
    );
  }

  const renderWhatsAppError = () => {
    if (!whatsappError) {
      return null;
    }
    const moduleUnavailable = isWhatsAppModuleUnavailableError(whatsappError);
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
        Error loading WhatsApp monitoring data: {whatsappError}
        <Button onClick={refreshData} variant="secondary" size="small">
          <IconRefresh size={16} />
          Retry
        </Button>
      </StyledErrorMessage>
    );
  };

  const renderLinkedInError = () => {
    if (!linkedinError) {
      return null;
    }
    const moduleUnavailable = isLinkedInModuleUnavailableError(linkedinError);
    if (moduleUnavailable) {
      return (
        <StyledUnavailableMessage>
          {LINKEDIN_MODULE_UNAVAILABLE_MESSAGE}
          <Button onClick={refreshData} variant="secondary" size="small">
            <IconRefresh size={16} />
            Retry
          </Button>
        </StyledUnavailableMessage>
      );
    }
    return (
      <StyledErrorMessage>
        Error loading LinkedIn Unipile monitoring data: {linkedinError}
        <Button onClick={refreshData} variant="secondary" size="small">
          <IconRefresh size={16} />
          Retry
        </Button>
      </StyledErrorMessage>
    );
  };

  return (
    <StyledContainer>
      <Section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <H2Title title="WhatsApp & Unipile monitoring" />
          <Button onClick={refreshData} variant="secondary" size="small">
            <IconRefresh size={16} />
            Refresh
          </Button>
        </div>

        <StyledChannelBlock>
          <H2Title title="WhatsApp session monitoring" />
          {renderWhatsAppError()}
          {!whatsappError && (
            <>
              <StyledCardsGrid>
                <Card>
                  <StyledCardHeader>
                    <StyledCardTitle>System status</StyledCardTitle>
                  </StyledCardHeader>
                  <CardContent>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Status 
                        color={whatsappHealthData?.getWhatsAppHealthStatus?.status === 'healthy' ? 'green' : 'red'} 
                        text={whatsappHealthData?.getWhatsAppHealthStatus?.status === 'healthy' ? 'Healthy' : 'Unhealthy'} 
                        weight="medium" 
                      />
                      <span style={{ fontSize: '14px', color: '#666' }}>
                        Last updated: {whatsappHealthData?.getWhatsAppHealthStatus?.timestamp ? new Date(whatsappHealthData.getWhatsAppHealthStatus.timestamp).toLocaleTimeString() : 'Never'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <StyledCardHeader>
                    <StyledCardTitle>Session overview</StyledCardTitle>
                  </StyledCardHeader>
                  <CardContent>
                    <StyledMetricsGrid>
                      <StyledMetricItem>
                        <StyledMetricLabel>Registered sessions</StyledMetricLabel>
                        <StyledMetricValue>{whatsappStatsData?.getWhatsAppSessionStats?.registeredSessions || 0}</StyledMetricValue>
                      </StyledMetricItem>
                      <StyledMetricItem>
                        <StyledMetricLabel>Active sessions</StyledMetricLabel>
                        <StyledMetricValue>{whatsappStatsData?.getWhatsAppSessionStats?.activeSessions || 0}</StyledMetricValue>
                      </StyledMetricItem>
                      <StyledMetricItem>
                        <StyledMetricLabel>Inactive sessions</StyledMetricLabel>
                        <StyledMetricValue>{whatsappStatsData?.getWhatsAppSessionStats?.inactiveSessions || 0}</StyledMetricValue>
                      </StyledMetricItem>
                      <StyledMetricItem>
                        <StyledMetricLabel>Memory usage</StyledMetricLabel>
                        <StyledMetricValue>{whatsappStatsData?.getWhatsAppSessionStats?.totalMemoryUsageMB || 0} MB</StyledMetricValue>
                      </StyledMetricItem>
                      <StyledMetricItem>
                        <StyledMetricLabel>Efficiency</StyledMetricLabel>
                        <StyledMetricValue>{Math.round(whatsappStatsData?.getWhatsAppSessionStats?.memoryEfficiency || 0)}%</StyledMetricValue>
                      </StyledMetricItem>
                    </StyledMetricsGrid>
                  </CardContent>
                </Card>
              </StyledCardsGrid>

              {whatsappStatsData?.getWhatsAppSessionStats && (
                <Card style={{ marginTop: '16px' }}>
                  <StyledCardHeader>
                    <StyledCardTitle>Session efficiency</StyledCardTitle>
                  </StyledCardHeader>
                  <CardContent>
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px' }}>
                        {whatsappStatsData.getWhatsAppSessionStats.activeSessions} of {whatsappStatsData.getWhatsAppSessionStats.totalSessions} sessions active
                      </span>
                    </div>
                    <StyledProgressBar 
                      value={whatsappStatsData.getWhatsAppSessionStats.totalSessions > 0 ? (whatsappStatsData.getWhatsAppSessionStats.activeSessions / whatsappStatsData.getWhatsAppSessionStats.totalSessions) * 100 : 0} 
                      color={whatsappStatsData.getWhatsAppSessionStats.memoryEfficiency > 80 ? 'green' : whatsappStatsData.getWhatsAppSessionStats.memoryEfficiency > 60 ? 'yellow' : 'red'}
                    />
                  </CardContent>
                </Card>
              )}

              {whatsappHealthData?.getWhatsAppHealthStatus?.metrics && whatsappHealthData.getWhatsAppHealthStatus.metrics.length > 0 && (
                <Card style={{ marginTop: '16px' }}>
                  <StyledCardHeader>
                    <StyledCardTitle>All sessions</StyledCardTitle>
                  </StyledCardHeader>
                  <CardContent>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {whatsappHealthData.getWhatsAppHealthStatus.metrics.map((session: any) => (
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
                                  color={getWhatsAppSessionStatusColor(session)} 
                                  text={getWhatsAppSessionStatusText(session)} 
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

              {whatsappHealthData?.getWhatsAppHealthStatus?.metrics && whatsappHealthData.getWhatsAppHealthStatus.metrics.length === 0 && (
                <Card style={{ marginTop: '16px' }}>
                  <CardContent>
                    <div style={{ textAlign: 'center', padding: '32px', color: '#666' }}>
                      No WhatsApp sessions found
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </StyledChannelBlock>

        <StyledChannelBlock style={{ marginTop: '8px' }}>
          <H2Title title="LinkedIn Unipile monitoring" />
          {renderLinkedInError()}
          {!linkedinError && (
            <>
              <StyledCardsGrid>
                <Card>
                  <StyledCardHeader>
                    <StyledCardTitle>System status</StyledCardTitle>
                  </StyledCardHeader>
                  <CardContent>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Status 
                        color={linkedinHealthData?.getLinkedInUnipileHealthStatus?.status === 'healthy' ? 'green' : 'red'} 
                        text={linkedinHealthData?.getLinkedInUnipileHealthStatus?.status === 'healthy' ? 'Healthy' : 'Unhealthy'} 
                        weight="medium" 
                      />
                      <span style={{ fontSize: '14px', color: '#666' }}>
                        Last updated: {linkedinHealthData?.getLinkedInUnipileHealthStatus?.timestamp ? new Date(linkedinHealthData.getLinkedInUnipileHealthStatus.timestamp).toLocaleTimeString() : 'Never'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <StyledCardHeader>
                    <StyledCardTitle>Session overview</StyledCardTitle>
                  </StyledCardHeader>
                  <CardContent>
                    <StyledMetricsGrid>
                      <StyledMetricItem>
                        <StyledMetricLabel>Registered accounts</StyledMetricLabel>
                        <StyledMetricValue>{linkedinStatsData?.getLinkedInUnipileSessionStats?.registeredSessions || 0}</StyledMetricValue>
                      </StyledMetricItem>
                      <StyledMetricItem>
                        <StyledMetricLabel>Active accounts</StyledMetricLabel>
                        <StyledMetricValue>{linkedinStatsData?.getLinkedInUnipileSessionStats?.activeSessions || 0}</StyledMetricValue>
                      </StyledMetricItem>
                      <StyledMetricItem>
                        <StyledMetricLabel>Inactive accounts</StyledMetricLabel>
                        <StyledMetricValue>{linkedinStatsData?.getLinkedInUnipileSessionStats?.inactiveSessions || 0}</StyledMetricValue>
                      </StyledMetricItem>
                      <StyledMetricItem>
                        <StyledMetricLabel>Efficiency</StyledMetricLabel>
                        <StyledMetricValue>{Math.round(linkedinStatsData?.getLinkedInUnipileSessionStats?.memoryEfficiency || 0)}%</StyledMetricValue>
                      </StyledMetricItem>
                    </StyledMetricsGrid>
                  </CardContent>
                </Card>
              </StyledCardsGrid>

              {linkedinStatsData?.getLinkedInUnipileSessionStats && (
                <Card style={{ marginTop: '16px' }}>
                  <StyledCardHeader>
                    <StyledCardTitle>Account efficiency</StyledCardTitle>
                  </StyledCardHeader>
                  <CardContent>
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px' }}>
                        {linkedinStatsData.getLinkedInUnipileSessionStats.activeSessions} of {linkedinStatsData.getLinkedInUnipileSessionStats.totalSessions} accounts active
                      </span>
                    </div>
                    <StyledProgressBar 
                      value={linkedinStatsData.getLinkedInUnipileSessionStats.totalSessions > 0 ? (linkedinStatsData.getLinkedInUnipileSessionStats.activeSessions / linkedinStatsData.getLinkedInUnipileSessionStats.totalSessions) * 100 : 0} 
                      color={linkedinStatsData.getLinkedInUnipileSessionStats.memoryEfficiency > 80 ? 'green' : linkedinStatsData.getLinkedInUnipileSessionStats.memoryEfficiency > 60 ? 'yellow' : 'red'}
                    />
                  </CardContent>
                </Card>
              )}

              {linkedinHealthData?.getLinkedInUnipileHealthStatus?.metrics && linkedinHealthData.getLinkedInUnipileHealthStatus.metrics.length > 0 && (
                <Card style={{ marginTop: '16px' }}>
                  <StyledCardHeader>
                    <StyledCardTitle>All LinkedIn accounts</StyledCardTitle>
                  </StyledCardHeader>
                  <CardContent>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {linkedinHealthData.getLinkedInUnipileHealthStatus.metrics.map((session: any) => (
                        <StyledSessionCard key={session.recruiterId}>
                          <CardContent>
                            <StyledSessionHeader>
                              <StyledSessionInfo>
                                <div style={{ fontWeight: '600' }}>
                                  Account: {session.recruiterId}
                                </div>
                                <div style={{ fontSize: '14px', color: '#666' }}>
                                  {session.isActive ? `Last activity: ${formatLastActivity(session.lastActivity)}` : 'Not active'}
                                </div>
                                <div style={{ fontSize: '12px', color: '#888' }}>
                                  {session.isRegistered ? '✓ Registered' : '✗ Not registered'} • 
                                  {session.hasAuthFiles ? ' ✓ Auth files' : ' ✗ No auth files'} • 
                                  {session.hasWebSocketConnection ? ' ✓ Session' : ' ✗ No session'} • 
                                  LinkedIn: {session.linkedinConnectionStatus}
                                </div>
                              </StyledSessionInfo>
                              <StyledSessionActions>
                                <Status 
                                  color={getLinkedInSessionStatusColor(session)} 
                                  text={getLinkedInSessionStatusText(session)} 
                                  weight="medium" 
                                />
                                {session.isActive && (
                                  <StyledBadge variant="secondary">
                                    {session.connectionCount} connections
                                  </StyledBadge>
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

              {linkedinHealthData?.getLinkedInUnipileHealthStatus?.metrics && linkedinHealthData.getLinkedInUnipileHealthStatus.metrics.length === 0 && (
                <Card style={{ marginTop: '16px' }}>
                  <CardContent>
                    <div style={{ textAlign: 'center', padding: '32px', color: '#666' }}>
                      No LinkedIn Unipile accounts found (configure linkedin_url or linkedin_unipile_account_id for this workspace)
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </StyledChannelBlock>
      </Section>
    </StyledContainer>
  );
};
