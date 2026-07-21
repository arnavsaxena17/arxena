import { IconMail } from 'twenty-ui/icons';
import { campaignMetricsState } from '@/drip-campaign/states/dripCampaignModalOpenState';
import styled from '@emotion/styled';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const StyledMetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
`;

const StyledMetricCard = styled.div`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const StyledMetricHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const StyledMetricTitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StyledMetricValue = styled.div`
  font-size: ${({ theme }) => theme.font.size.xxl};
  font-weight: ${({ theme }) => theme.font.weight.bold};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledMetricChange = styled.div<{ isPositive: boolean }>`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme, isPositive }) => 
    isPositive ? theme.color.green60 : theme.color.red60};
  display: flex;
  align-items: center;
  gap: 4px;
`;

const StyledChartContainer = styled.div`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: 12px;
  padding: 24px;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledRefreshButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: 8px;
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.background.transparent.light};
  }
`;

const StyledEmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: ${({ theme }) => theme.font.color.tertiary};
`;

interface CampaignMetricsProps {
  campaignId: string;
}

export const CampaignMetrics: React.FC<CampaignMetricsProps> = ({ campaignId }) => {
  const allMetrics = useRecoilValue(campaignMetricsState);
  const [isLoading, setIsLoading] = useState(false);
  
  const metrics = allMetrics.find(m => m.campaignId === campaignId);

  const refreshMetrics = async () => {
    setIsLoading(true);
    // TODO: Implement refresh metrics logic
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  useEffect(() => {
    refreshMetrics();
  }, [campaignId]);

  if (!metrics) {
    return (
      <StyledContainer>
        <StyledEmptyState>
          <IconMail size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <div>No metrics available for this campaign yet.</div>
          <div style={{ fontSize: '14px', marginTop: '8px' }}>
            Metrics will appear once emails are sent.
          </div>
        </StyledEmptyState>
      </StyledContainer>
    );
  }

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatNumber = (value: number) => value.toLocaleString();

  const metricCards = [
    {
      title: 'Total Sent',
      value: formatNumber(metrics.totalSent),
      icon: <IconMail size={16} />,
      change: null
    },
    {
      title: 'Delivered',
      value: formatNumber(metrics.totalDelivered),
      icon: <IconMail size={16} />,
      change: null
    },
    {
      title: 'Opened',
      value: formatNumber(metrics.totalOpened),
      icon: <IconMail size={16} />,
      change: {
        value: formatPercentage(metrics.openRate),
        isPositive: true
      }
    },
    {
      title: 'Clicked',
      value: formatNumber(metrics.totalClicked),
      icon: <IconMail size={16} />,
      change: {
        value: formatPercentage(metrics.clickRate),
        isPositive: true
      }
    },
    {
      title: 'Replied',
      value: formatNumber(metrics.totalReplied),
      icon: <IconMail size={16} />,
      change: {
        value: formatPercentage(metrics.replyRate),
        isPositive: true
      }
    },
    {
      title: 'Bounced',
      value: formatNumber(metrics.totalBounced),
      icon: <IconMail size={16} />,
      change: {
        value: formatPercentage(metrics.bounceRate),
        isPositive: false
      }
    }
  ];

  return (
    <StyledContainer>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Campaign Performance</h3>
        <StyledRefreshButton onClick={refreshMetrics} disabled={isLoading}>
          🔄 Refresh
        </StyledRefreshButton>
      </div>

      <StyledMetricsGrid>
        {metricCards.map((metric, index) => (
          <StyledMetricCard key={index}>
            <StyledMetricHeader>
              <StyledMetricTitle>
                {metric.icon}
                {metric.title}
              </StyledMetricTitle>
            </StyledMetricHeader>
            <StyledMetricValue>{metric.value}</StyledMetricValue>
            {metric.change && (
              <StyledMetricChange isPositive={metric.change.isPositive}>
                {metric.change.isPositive ? '📈' : '📉'} {metric.change.value}
              </StyledMetricChange>
            )}
          </StyledMetricCard>
        ))}
      </StyledMetricsGrid>

      <StyledChartContainer>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', opacity: 0.3, marginBottom: '16px' }}>📊</div>
          <div>Performance Chart</div>
          <div style={{ fontSize: '14px', marginTop: '8px' }}>
            Chart visualization will be implemented here
          </div>
        </div>
      </StyledChartContainer>
    </StyledContainer>
  );
};
