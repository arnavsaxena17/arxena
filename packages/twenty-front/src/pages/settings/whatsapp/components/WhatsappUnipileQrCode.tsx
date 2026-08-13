import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { styled } from '@linaria/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { tokenPairState } from '~/modules/auth/states/tokenPairState';
import { getWhatsappUnipileService } from '~/pages/settings/whatsapp/services/whatsapp-unipile-backend.service';

const Card = styled.div`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 8px;
  box-shadow: ${themeCssVariables.boxShadow.light};
  margin: 2rem auto;
  max-width: 600px;
  padding: 1.5rem;
`;

const CardHeader = styled.div`
  margin-bottom: 1.5rem;
`;

const CardTitle = styled.h2`
  color: ${themeCssVariables.font.color.primary};
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
`;

const Alert = styled.div<{ variant?: 'info' | 'error' | 'success' }>`
  border-radius: 4px;
  margin-bottom: 1.5rem;
  padding: 1rem;

  ${props => {
    switch (props.variant) {
      case 'error':
        return `
          background: ${themeCssVariables.background.transparent.danger};
          border: 1px solid ${themeCssVariables.border.color.danger};
          color: ${themeCssVariables.font.color.danger};
        `;
      case 'success':
        return `
          background: ${themeCssVariables.background.transparent.success};
          border: 1px solid ${themeCssVariables.color.green};
          color: ${themeCssVariables.color.green};
        `;
      default:
        return `
          background: ${themeCssVariables.background.tertiary};
          border: 1px solid ${themeCssVariables.border.color.medium};
          color: ${themeCssVariables.font.color.secondary};
        `;
    }
  }}
`;

const AlertDescription = styled.p`
  font-size: 0.875rem;
  line-height: 1.5;
  margin: 0;
`;

const QrCodeContainer = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.tertiary};
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 1.5rem 0;
  padding: 2rem;
`;

const QrCodeWrapper = styled.div`
  background: white;
  border-radius: 8px;
  box-shadow: ${themeCssVariables.boxShadow.light};
  padding: 1rem;
`;

const Instructions = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 0.875rem;
  line-height: 1.6;
  text-align: center;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  background-color: ${({ variant }) =>
    variant === 'primary' ? '#25d366' : themeCssVariables.background.tertiary};
  border: ${({ variant }) =>
    variant === 'primary'
      ? 'none'
      : `1px solid ${themeCssVariables.border.color.medium}`};
  border-radius: 4px;
  color: ${({ variant }) =>
    variant === 'primary' ? 'white' : themeCssVariables.font.color.primary};
  cursor: pointer;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  padding: 0.75rem 1rem;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ variant }) =>
      variant === 'primary'
        ? '#128c7e'
        : themeCssVariables.background.quaternary};
  }

  &:disabled {
    background-color: ${themeCssVariables.background.quaternary};
    cursor: not-allowed;
  }

  &:focus {
    box-shadow: 0 0 0 2px rgba(37, 211, 102, 0.4);
    outline: none;
  }
`;

const LoadingSpinner = styled.div`
  animation: spin 1s linear infinite;
  border: 2px solid #e5e7eb;
  border-radius: 50%;
  border-top-color: #25d366;
  display: inline-block;
  height: 1rem;
  margin-right: 0.5rem;
  width: 1rem;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const CONNECTION_FAILED_AUTO_REFRESH_DELAY_MS = 2000;

const isConnectionFailedErrorMessage = (message: string | null): boolean => {
  if (!message) {
    return false;
  }
  return message.includes('Connection failed');
};

const StatusIndicator = styled.div<{ status: 'connecting' | 'connected' | 'error' }>`
  align-items: center;
  border-radius: 4px;
  display: flex;
  font-size: 0.875rem;
  font-weight: 500;
  gap: 0.5rem;
  padding: 0.75rem;

  ${props => {
    switch (props.status) {
      case 'connecting':
        return `
          background: #fef3c7;
          color: #d97706;
        `;
      case 'connected':
        return `
          background: #f0fdf4;
          color: #16a34a;
        `;
      case 'error':
        return `
          background: #fef2f2;
          color: #dc2626;
        `;
    }
  }}
`;

interface WhatsappUnipileQrCodeProps {
  onConnected?: (accountId: string) => void;
}

export const WhatsappUnipileQrCode: React.FC<WhatsappUnipileQrCodeProps> = ({
  onConnected,
}) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const pollingStartTimeRef = useRef<number | null>(null);

  const tokenPair = useAtomStateValue(tokenPairState);
  const accessToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  const startPolling = useCallback((accountIdToPoll: string) => {
    const service = getWhatsappUnipileService();
    let disconnectedCount = 0;
    const interval = setInterval(async () => {
      try {
        const statusResponse = await service.checkAccountStatus(accountIdToPoll, accessToken);

        if (statusResponse.status === 'connected') {
          setStatus('connected');
          clearInterval(interval);
          setPollingInterval(null);

          // Update workspace member profile with WhatsApp Unipile account ID
          try {
            const service = getWhatsappUnipileService();
            const result = await service.updateMemberAccount(statusResponse.account_id, accessToken);
            if (!result.success) {
              console.error('Failed to update workspace member profile with WhatsApp account ID');
            }
          } catch (apiKeyError) {
            console.error('Failed to update workspace member profile with WhatsApp account ID:', apiKeyError);
          }

          if (onConnected) {
            onConnected(statusResponse.account_id);
          }
        } else if (statusResponse.status === 'disconnected') {
          // Only show error if we've been polling for at least 30 seconds
          // This gives the user time to scan the QR code
          const timeSinceStart = pollingStartTimeRef.current ? Date.now() - pollingStartTimeRef.current : 0;
          disconnectedCount++;

          // Show error only after 30 seconds of polling or 3 consecutive disconnected checks
          if (timeSinceStart > 30000 || disconnectedCount >= 3) {
            setStatus('error');
            setError('Connection failed. Please try again.');
            clearInterval(interval);
            setPollingInterval(null);
          }
          // Otherwise, continue polling silently
        } else {
          // Reset disconnected count if status is pending/connecting
          disconnectedCount = 0;
        }
        // Continue polling for 'pending' or 'connecting' status
      } catch (err) {
        console.error('Failed to check account status:', err);
        // Don't stop polling on error, just log it
      }
    }, 3000); // Poll every 3 seconds

    setPollingInterval(interval);

    // Stop polling after 5 minutes (300 seconds)
    setTimeout(() => {
      clearInterval(interval);
      setPollingInterval((prev) => {
        if (prev === interval) {
          return null;
        }
        return prev;
      });
      setStatus((prevStatus) => {
        if (prevStatus !== 'connected') {
          setError('QR code expired. Please generate a new one.');
          setQrCode(null);
        }
        return prevStatus;
      });
    }, 300000);
  }, [accessToken, onConnected]);

  const requestQrCode = useCallback(async () => {
    if (!accessToken) {
      setError('Authentication token not available. Please refresh the page and try again.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setStatus('connecting');

      const service = getWhatsappUnipileService();
      const response = await service.requestQrCode(accessToken);

      if (response.alreadyConnected && response.account_id) {
        setStatus('connected');
        setQrCode(null);
        if (onConnected) {
          onConnected(response.account_id);
        }
        return;
      }

      if (response.code) {
        console.log('response qr code', response);
        setQrCode(response.code);
        setAccountId(response.account_id || null);
        pollingStartTimeRef.current = null;

        if (response.account_id) {
          const accountIdToPoll = response.account_id;
          // Wait 10 seconds before starting to poll to give user time to scan
          setTimeout(() => {
            pollingStartTimeRef.current = Date.now();
            startPolling(accountIdToPoll);
          }, 10000);
        }
      } else {
        setError('Failed to generate QR code. Please try again.');
        setStatus('error');
      }
    } catch (err) {
      console.error('Failed to request QR code:', err);
      setError(err instanceof Error ? err.message : 'Failed to request QR code');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  }, [accessToken, startPolling]);

  const handleGenerateNew = useCallback(() => {
    setPollingInterval((prev) => {
      if (prev) {
        clearInterval(prev);
      }
      return null;
    });
    setQrCode(null);
    setStatus('connecting');
    pollingStartTimeRef.current = null;
    setError(null);
    requestQrCode();
  }, [requestQrCode]);

  useEffect(() => {
    // Request QR code on mount
    requestQrCode();

    // Cleanup polling on unmount
    return () => {
      setPollingInterval((prev) => {
        if (prev) {
          clearInterval(prev);
        }
        return null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  useEffect(() => {
    if (!isConnectionFailedErrorMessage(error) || loading) {
      return undefined;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const runRefreshWhenVisible = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      handleGenerateNew();
    };

    const schedule = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        if (document.visibilityState !== 'visible') {
          document.addEventListener('visibilitychange', onVisible);
          return;
        }
        runRefreshWhenVisible();
      }, CONNECTION_FAILED_AUTO_REFRESH_DELAY_MS);
    };

    const onVisible = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      document.removeEventListener('visibilitychange', onVisible);
      schedule();
    };

    schedule();

    return () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [error, loading, handleGenerateNew]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect WhatsApp Account</CardTitle>
      </CardHeader>

      {error && (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {status === 'connected' && (
        <Alert variant="success">
          <AlertDescription>
            WhatsApp account connected successfully! You can now use WhatsApp features.
          </AlertDescription>
        </Alert>
      )}

      <Alert variant="info">
        <AlertDescription>
          Scan the QR code with your WhatsApp mobile app to connect your account.
          Open WhatsApp → Settings → Linked Devices → Link a Device
        </AlertDescription>
      </Alert>

      {qrCode && status !== 'connected' && (
        <StatusIndicator status={status}>
          {status === 'connecting' && (
            <>
              <LoadingSpinner />
              Waiting for QR code scan...
            </>
          )}
          {status === 'error' && 'Connection failed'}
        </StatusIndicator>
      )}

      {qrCode && status !== 'connected' && (
        <QrCodeContainer>
          <QrCodeWrapper>
            <QRCode value={qrCode} size={256} />
          </QrCodeWrapper>
          <Instructions>
            <strong>Steps to connect:</strong>
            <br />
            1. Open WhatsApp on your phone
            <br />
            2. Go to Settings → Linked Devices
            <br />
            3. Tap "Link a Device"
            <br />
            4. Scan this QR code
          </Instructions>
        </QrCodeContainer>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
        {qrCode && status !== 'connected' && (
          <Button variant="secondary" onClick={handleGenerateNew} disabled={loading}>
            Generate New QR Code
          </Button>
        )}
        {!qrCode && (
          <Button variant="primary" onClick={requestQrCode} disabled={loading}>
            {loading && <LoadingSpinner />}
            Generate QR Code
          </Button>
        )}
      </div>
    </Card>
  );
};

