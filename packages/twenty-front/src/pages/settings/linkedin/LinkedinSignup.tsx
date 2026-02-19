import { tokenPairState } from '@/auth/states/tokenPairState';
import { css } from '@emotion/react';
import styled from '@emotion/styled';
import React, { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';
import type {
  LinkedinCookieAuth,
  LinkedinCredentials,
  LinkedinSignupCompleteData,
  LinkedinSignupProps
} from 'twenty-shared';
import { getLinkedinService } from '~/pages/settings/linkedin/services/linkedin-backend.service';

const Card = styled.div`
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-width: 600px;
  margin: 2rem auto;
  padding: 1.5rem;
`;

const CardHeader = styled.div`
  margin-bottom: 1.5rem;
`;

const CardTitle = styled.h2`
  color: #1a1a1a;
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
`;

const Alert = styled.div<{ variant?: 'info' | 'error' | 'success' }>`
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  
  ${props => {
    switch (props.variant) {
      case 'error':
        return css`
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
        `;
      case 'success':
        return css`
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #16a34a;
        `;
      default:
        return css`
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          color: #4a5568;
        `;
    }
  }}
`;

const AlertDescription = styled.p`
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
`;

const Input = styled.input`
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
  
  &:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
  }
`;

const Textarea = styled.textarea`
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
  min-height: 100px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
  }
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  padding: 0.75rem 1rem;
  transition: all 0.2s ease;
  
  ${props => {
    switch (props.variant) {
      case 'primary':
        return css`
          background-color: #0077b5;
          color: white;
          &:hover {
            background-color: #005885;
          }
          &:disabled {
            background-color: #94a3b8;
            cursor: not-allowed;
          }
        `;
      case 'danger':
        return css`
          background-color: #dc2626;
          color: white;
          &:hover {
            background-color: #b91c1c;
          }
        `;
      default:
        return css`
          background-color: #f8fafc;
          color: #475569;
          border: 1px solid #d1d5db;
          &:hover {
            background-color: #f1f5f9;
          }
        `;
    }
  }}

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(5, 119, 181, 0.4);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 50%;
  border-top-color: #0077b5;
  animation: spin 1s linear infinite;
  margin-right: 0.5rem;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const TabContainer = styled.div`
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 1.5rem;
`;

const Tab = styled.button<{ active: boolean }>`
  background: none;
  border: none;
  padding: 0.75rem 1rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  color: ${props => props.active ? '#0077b5' : '#6b7280'};
  border-bottom: 2px solid ${props => props.active ? '#0077b5' : 'transparent'};
  
  &:hover {
    color: #0077b5;
  }
`;

export const LinkedinSignup: React.FC<LinkedinSignupProps> = ({
  onSignupComplete,
  onSignupCancel,
  onSignupError,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<'hosted' | 'credentials' | 'cookie'>('hosted');
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  const [accountId, setAccountId] = useState<string>('');
  const [checkpointCode, setCheckpointCode] = useState('');

  const [credentialsForm, setCredentialsForm] = useState<LinkedinCredentials>({
    username: '',
    password: '',
  });

  const [cookieForm, setCookieForm] = useState<LinkedinCookieAuth>({
    access_token: '',
    user_agent: '',
  });

  // Get access token from Recoil state
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken.token;

  const handleError = useCallback((error: Error | string) => {
    const errorMessage = typeof error === 'string' ? error : error.message;
    setError(errorMessage);
    onSignupError?.(typeof error === 'string' ? new Error(error) : error);
  }, [onSignupError]);

  const handleSuccess = useCallback((data: LinkedinSignupCompleteData) => {
    setSuccess('LinkedIn account connected successfully!');
    setError(null);
    onSignupComplete?.(data);
  }, [onSignupComplete]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentialsForm.username || !credentialsForm.password) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const service = getLinkedinService();
      const response = await service.connectWithCredentials(credentialsForm, accessToken);
      
      if (response.success && response.data) {
        if (response.data.status === 'checkpoint_required') {
          setAccountId(response.data.account_id);
          setShowCheckpoint(true);
        } else {
          handleSuccess({
            accountId: response.data.account_id,
            username: credentialsForm.username,
            status: 'connected',
            profileData: response.data.profile,
          });
        }
      } else {
        handleError(response.error || 'Failed to connect LinkedIn account');
      }
    } catch (err) {
      handleError(err instanceof Error ? err : new Error('Unknown error occurred'));
    } finally {
      setLoading(false);
    }
  };

  const handleCookieSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookieForm.access_token || !cookieForm.user_agent) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const service = getLinkedinService();
      const response = await service.connectWithCookie(cookieForm, accessToken);
      
      if (response.success && response.data) {
        if (response.data.status === 'checkpoint_required') {
          setAccountId(response.data.account_id);
          setShowCheckpoint(true);
        } else {
          handleSuccess({
            accountId: response.data.account_id,
            status: 'connected',
            profileData: response.data.profile,
          });
        }
      } else {
        handleError(response.error || 'Failed to connect LinkedIn account');
      }
    } catch (err) {
      handleError(err instanceof Error ? err : new Error('Unknown error occurred'));
    } finally {
      setLoading(false);
    }
  };

  const handleHostedAuth = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const service = getLinkedinService();
      
      // Get current URL without hash/query params for cleaner redirects
      const currentUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
      console.log('currentUrl::::', currentUrl);
      const response = await service.createHostedAuthLink({
        type: 'create',
        providers: ['LINKEDIN'],
        success_redirect_url: `${currentUrl}?linkedin_auth=success`,
        failure_redirect_url: `${currentUrl}?linkedin_auth=failure`,
      }, accessToken);
      
      if (response.success && response.hosted_link) {
        // Redirect to hosted auth wizard (recommended approach from Unipile docs)
        window.location.href = response.hosted_link;
      } else {
        throw new Error('Failed to get hosted auth link');
      }
    } catch (err) {
      handleError(err instanceof Error ? err : new Error('Failed to create hosted auth link'));
      setLoading(false);
    }
  };

  // Check for auth results on component mount
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authResult = urlParams.get('linkedin_auth');
    
    if (authResult === 'success') {
      setSuccess('LinkedIn account connected successfully! You can now use LinkedIn features.');
      handleSuccess({
        status: 'connected',
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authResult === 'failure') {
      setError('LinkedIn authentication failed. Please try again.');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [handleSuccess]);

  const handleCheckpointSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkpointCode || !accountId) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const service = getLinkedinService();
      const response = await service.solveCheckpoint({
        account_id: accountId,
        provider: 'LINKEDIN',
        code: checkpointCode,
      }, accessToken);
      
      if (response.success && response.data) {
        if (response.data.status === 'checkpoint_required') {
          setAccountId(response.data.account_id);
          setError(null);
          setCheckpointCode('');
        } else {
          setShowCheckpoint(false);
          handleSuccess({
            accountId: response.data.account_id,
            status: 'connected',
            profileData: response.data.profile,
          });
        }
      } else {
        handleError(response.error || 'Failed to verify code');
      }
    } catch (err) {
      handleError(err instanceof Error ? err : new Error('Unknown error occurred'));
    } finally {
      setLoading(false);
    }
  };

  if (showCheckpoint) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>LinkedIn Verification Required</CardTitle>
        </CardHeader>
        
        <Alert variant="info">
          <AlertDescription>
            LinkedIn requires additional verification. Please check your email or LinkedIn notifications for a verification code.
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form onSubmit={handleCheckpointSubmit}>
          <FormGroup>
            <Label>Verification Code</Label>
            <Input
              type="text"
              value={checkpointCode}
              onChange={(e) => setCheckpointCode(e.target.value)}
              placeholder="Enter verification code"
              required
            />
          </FormGroup>

          <ButtonGroup>
            <Button
              type="button"
              onClick={() => {
                setShowCheckpoint(false);
                onSignupCancel?.('checkpoint');
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading && <LoadingSpinner />}
              Verify
            </Button>
          </ButtonGroup>
        </Form>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect LinkedIn Account</CardTitle>
      </CardHeader>

      {error && (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Alert variant="info">
        <AlertDescription>
          Connect your LinkedIn account to enable messaging, profile insights, and networking features through the Arxena platform.
        </AlertDescription>
      </Alert>

      <TabContainer>
        <Tab 
          active={authMethod === 'hosted'} 
          onClick={() => setAuthMethod('hosted')}
        >
          Secure Login (Recommended)
        </Tab>
        <Tab 
          active={authMethod === 'credentials'} 
          onClick={() => setAuthMethod('credentials')}
        >
          Username/Password
        </Tab>
        <Tab 
          active={authMethod === 'cookie'} 
          onClick={() => setAuthMethod('cookie')}
        >
          Cookie/User-Agent
        </Tab>
      </TabContainer>

      {authMethod === 'credentials' && (
        <Form onSubmit={handleCredentialsSubmit}>
          <FormGroup>
            <Label>LinkedIn Username/Email</Label>
            <Input
              type="text"
              value={credentialsForm.username}
              onChange={(e) => setCredentialsForm(prev => ({ ...prev, username: e.target.value }))}
              placeholder="your.email@example.com"
              required
            />
          </FormGroup>

          <FormGroup>
            <Label>LinkedIn Password</Label>
            <Input
              type="password"
              value={credentialsForm.password}
              onChange={(e) => setCredentialsForm(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Your LinkedIn password"
              required
            />
          </FormGroup>

          <Button type="submit" variant="primary" disabled={loading}>
            {loading && <LoadingSpinner />}
            Connect LinkedIn Account
          </Button>
        </Form>
      )}

      {authMethod === 'cookie' && (
        <Form onSubmit={handleCookieSubmit}>
          <FormGroup>
            <Label>Access Token/Cookie</Label>
            <Textarea
              value={cookieForm.access_token}
              onChange={(e) => setCookieForm(prev => ({ ...prev, access_token: e.target.value }))}
              placeholder="Paste your LinkedIn access token or cookie value here"
              required
            />
          </FormGroup>

          <FormGroup>
            <Label>User Agent</Label>
            <Input
              type="text"
              value={cookieForm.user_agent}
              onChange={(e) => setCookieForm(prev => ({ ...prev, user_agent: e.target.value }))}
              placeholder="Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:15.0) Gecko/20100101 Firefox/15.0.1"
              required
            />
          </FormGroup>

          <Button type="submit" variant="primary" disabled={loading}>
            {loading && <LoadingSpinner />}
            Connect with Cookie
          </Button>
        </Form>
      )}

      {authMethod === 'hosted' && (
        <div>
          <Alert variant="info">
            <AlertDescription>
              Use Arxena's secure hosted authentication wizard for the safest and most reliable LinkedIn connection. This method supports OAuth, QR codes, and handles captchas automatically. You'll be redirected to a secure authentication page.
            </AlertDescription>
          </Alert>
          
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: '600', color: '#374151' }}>
              ✅ Benefits of Hosted Auth:
            </h4>
            <ul style={{ margin: '0', paddingLeft: '1.2rem', fontSize: '0.875rem', color: '#6b7280' }}>
              <li>Most secure authentication method</li>
              <li>Automatic captcha solving</li>
              <li>Support for 2FA and OAuth</li>
              <li>QR code scanning for mobile</li>
              <li>No credential storage on your device</li>
            </ul>
          </div>
          
          <Button onClick={handleHostedAuth} variant="primary" disabled={loading}>
            {loading && <LoadingSpinner />}
            Connect with LinkedIn Securely
          </Button>
        </div>
      )}
    </Card>
  );
};

export default LinkedinSignup;