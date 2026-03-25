import styled from '@emotion/styled';
import { useEffect, useState } from 'react';

type LinkedinSyncStatus = {
  success: boolean;
  authenticated: boolean;
  onLinkedinPage: boolean;
  cookies?: {
    hasLiAt: boolean;
    hasLiA: boolean;
  };
  linkedin?: {
    accountId: string | null;
    status:
      | 'connected'
      | 'disconnected'
      | 'pending'
      | 'checkpoint_required'
      | 'not_connected';
    connected: boolean;
  };
  reconnect?: {
    attempted: boolean;
    succeeded: boolean;
    message: string | null;
  };
  error?: string;
};

const StyledWrapper = styled.div`
  background: linear-gradient(180deg, #f6f9fc 0%, #eef3f8 100%);
  color: #12324a;
  min-height: 500px;
  width: 100%;
`;

const StyledContainer = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 500px;
  padding: 18px;
  width: 360px;
`;

const StyledTitle = styled.h1`
  font-size: 20px;
  line-height: 1.2;
  margin: 0;
`;

const StyledSubtitle = styled.p`
  color: #567086;
  font-size: 13px;
  line-height: 1.4;
  margin: 0;
`;

const StyledCard = styled.div`
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #d9e5ef;
  border-radius: 14px;
  padding: 14px;
`;

const StyledStatusPill = styled.span<{ tone: 'green' | 'red' | 'amber' | 'blue' }>`
  align-self: flex-start;
  background: ${({ tone }) =>
    tone === 'green'
      ? '#def7e8'
      : tone === 'red'
        ? '#fde7e9'
        : tone === 'amber'
          ? '#fff4d6'
          : '#e2f0ff'};
  border-radius: 999px;
  color: ${({ tone }) =>
    tone === 'green'
      ? '#0b6b3a'
      : tone === 'red'
        ? '#9b1c2c'
        : tone === 'amber'
          ? '#8a5b00'
          : '#145ea8'};
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  padding: 6px 10px;
`;

const StyledLabel = styled.div`
  color: #567086;
  font-size: 12px;
  margin-bottom: 4px;
  text-transform: uppercase;
`;

const StyledValue = styled.div`
  font-size: 14px;
  font-weight: 600;
`;

const StyledGrid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr 1fr;
  margin-top: 12px;
`;

const StyledButton = styled.button`
  background: #0f6cbd;
  border: 0;
  border-radius: 10px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  padding: 10px 14px;
`;

const StyledMuted = styled.p`
  color: #567086;
  font-size: 13px;
  line-height: 1.4;
  margin: 0;
`;

const getActiveLinkedinContext = async (): Promise<{
  pageUrl?: string;
  userAgent?: string;
  onLinkedinPage: boolean;
}> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pageUrl = tab?.url ?? '';
  const onLinkedinPage = /^https?:\/\/(?:[\w-]+\.)?linkedin\.com/i.test(pageUrl);

  if (!onLinkedinPage || !tab?.id) {
    return { pageUrl, onLinkedinPage };
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'getLinkedinPageContext',
    });

    return {
      pageUrl: response?.pageUrl ?? pageUrl,
      userAgent: response?.userAgent,
      onLinkedinPage: response?.onLinkedinPage ?? onLinkedinPage,
    };
  } catch {
    return { pageUrl, onLinkedinPage };
  }
};

const formatConnectionLabel = (status?: LinkedinSyncStatus['linkedin']) => {
  if (!status) {
    return 'Unknown';
  }

  switch (status.status) {
    case 'connected':
      return 'Connected';
    case 'pending':
      return 'Syncing';
    case 'checkpoint_required':
      return 'Checkpoint required';
    case 'disconnected':
      return 'Disconnected';
    default:
      return 'Not connected';
  }
};

const getTone = (status?: LinkedinSyncStatus['linkedin']) => {
  if (!status) {
    return 'blue' as const;
  }

  switch (status.status) {
    case 'connected':
      return 'green' as const;
    case 'pending':
    case 'checkpoint_required':
      return 'amber' as const;
    case 'disconnected':
    case 'not_connected':
      return 'red' as const;
    default:
      return 'blue' as const;
  }
};

const shortenId = (value?: string | null) =>
  value ? `${value.slice(0, 8)}...${value.slice(-4)}` : 'None';

const PopupApp = () => {
  const [status, setStatus] = useState<LinkedinSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStatus = async () => {
    setLoading(true);

    const context = await getActiveLinkedinContext();

    if (!context.onLinkedinPage) {
      setStatus({
        success: false,
        authenticated: true,
        onLinkedinPage: false,
        error: 'Open this popup on a LinkedIn page to sync cookies and connection state.',
      });
      setLoading(false);
      return;
    }

    const response = (await chrome.runtime.sendMessage({
      action: 'syncLinkedinCookies',
      pageUrl: context.pageUrl,
      userAgent: context.userAgent,
    })) as LinkedinSyncStatus;

    setStatus(response);
    setLoading(false);
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  return (
    <StyledWrapper>
      <StyledContainer>
        <div>
          <StyledTitle>Arxena LinkedIn</StyledTitle>
          <StyledSubtitle>
            Sync `li_at` and `li_a` into the current workspace member profile and
            reconnect LinkedIn when possible.
          </StyledSubtitle>
        </div>

        <StyledButton onClick={() => void refreshStatus()}>
          {loading ? 'Refreshing...' : 'Refresh status'}
        </StyledButton>

        {loading && <StyledMuted>Checking LinkedIn cookies and account status...</StyledMuted>}

        {!loading && status && (
          <>
            <StyledCard>
              <StyledStatusPill tone={getTone(status.linkedin)}>
                {status.onLinkedinPage
                  ? formatConnectionLabel(status.linkedin)
                  : 'Not on LinkedIn'}
              </StyledStatusPill>
              <StyledGrid>
                <div>
                  <StyledLabel>li_at stored</StyledLabel>
                  <StyledValue>{status.cookies?.hasLiAt ? 'Yes' : 'No'}</StyledValue>
                </div>
                <div>
                  <StyledLabel>li_a stored</StyledLabel>
                  <StyledValue>{status.cookies?.hasLiA ? 'Yes' : 'No'}</StyledValue>
                </div>
                <div>
                  <StyledLabel>LinkedIn account</StyledLabel>
                  <StyledValue>{shortenId(status.linkedin?.accountId)}</StyledValue>
                </div>
                <div>
                  <StyledLabel>Reconnect</StyledLabel>
                  <StyledValue>
                    {status.reconnect?.attempted
                      ? status.reconnect.succeeded
                        ? 'Attempted'
                        : 'Attempt failed'
                      : 'Not needed'}
                  </StyledValue>
                </div>
              </StyledGrid>
            </StyledCard>

            {(status.error || status.reconnect?.message) && (
              <StyledCard>
                <StyledLabel>Details</StyledLabel>
                <StyledMuted>
                  {status.error ?? status.reconnect?.message ?? 'No additional details.'}
                </StyledMuted>
              </StyledCard>
            )}

            {!status.authenticated && (
              <StyledCard>
                <StyledMuted>
                  The extension needs your Arxena access token before it can update
                  workspace member profiles.
                </StyledMuted>
              </StyledCard>
            )}
          </>
        )}
      </StyledContainer>
    </StyledWrapper>
  );
};

export default PopupApp;
