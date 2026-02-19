import { SubTitle } from '@/auth/components/SubTitle';
import { Title } from '@/auth/components/Title';
import { useAuth } from '@/auth/hooks/useAuth';
import { currentUserState } from '@/auth/states/currentUserState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { SKIP_CONNECT_LINKEDIN_ONBOARDING_STEP } from '@/onboarding/graphql/mutations/skipConnectLinkedinOnboardingStep';
import { useSetNextOnboardingStatus } from '@/onboarding/hooks/useSetNextOnboardingStatus';
import { TextInputV2 } from '@/ui/input/components/TextInputV2';
import { useMutation } from '@apollo/client';
import styled from '@emotion/styled';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import type {
  LinkedinCookieAuth,
  LinkedinCredentials,
  LinkedinSignupCompleteData,
} from 'twenty-shared';
import {
  ActionLink,
  H2Title,
  LightButton,
  Loader,
  MainButton,
} from 'twenty-ui';
import { OnboardingStatus } from '~/generated/graphql';
import { getLinkedinService } from '~/pages/settings/linkedin/services/linkedin-backend.service';

const StyledContentContainer = styled.div`
  width: 100%;
`;

const StyledSectionContainer = styled.div`
  margin-top: ${({ theme }) => theme.spacing(8)};
`;

const StyledButtonContainer = styled.div`
  margin-top: ${({ theme }) => theme.spacing(8)};
  margin-left: auto;
  margin-right: auto;
  width: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledSkipContainer = styled.div`
  margin: ${({ theme }) => theme.spacing(3)} 0 0;
  display: flex;
  justify-content: center;
`;

const StyledTabRow = styled.div`
  display: flex;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
  gap: 0;
`;

const StyledTab = styled.button<{ active: boolean }>`
  background: none;
  border: none;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: 500;
  font-family: ${({ theme }) => theme.font.family};
  color: ${({ theme, active }) =>
    active ? theme.font.color.primary : theme.font.color.tertiary};
  border-bottom: 2px solid
    ${({ theme, active }) =>
      active ? theme.font.color.primary : 'transparent'};
  margin-bottom: -1px;

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledMessage = styled.div<{
  variant: 'error' | 'success' | 'info';
}>`
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: 1.5;
  ${({ theme, variant }) => {
    switch (variant) {
      case 'error':
        return `
          background: ${theme.background.danger};
          border: 1px solid ${theme.border.color.danger};
          color: ${theme.font.color.danger};
        `;
      case 'success':
        return `
          background: ${theme.background.transparent.light};
          border: 1px solid ${theme.border.color.medium};
          color: ${theme.font.color.primary};
        `;
      default:
        return `
          background: ${theme.background.transparent.light};
          border: 1px solid ${theme.border.color.medium};
          color: ${theme.font.color.secondary};
        `;
    }
  }}
`;

const StyledBenefitsList = styled.ul`
  margin: 0 0 ${({ theme }) => theme.spacing(4)};
  padding-left: ${({ theme }) => theme.spacing(4)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  line-height: 1.6;
`;

const StyledComboInputContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
`;

type AuthMethod = 'hosted' | 'credentials' | 'cookie';

export const ConnectLinkedin = () => {
  const { t } = useLingui();
  const currentUser = useRecoilValue(currentUserState);
  const tokenPair = useRecoilValue(tokenPairState);
  const setNextOnboardingStatus = useSetNextOnboardingStatus();
  const { loadCurrentUser } = useAuth();
  const [skipConnectLinkedinOnboardingStep] = useMutation(
    SKIP_CONNECT_LINKEDIN_ONBOARDING_STEP,
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('credentials');
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [checkpointCode, setCheckpointCode] = useState('');
  const [credentialsForm, setCredentialsForm] = useState<LinkedinCredentials>({
    username: '',
    password: '',
  });
  const [cookieForm, setCookieForm] = useState<LinkedinCookieAuth>({
    access_token: '',
    user_agent: '',
  });

  const accessToken = tokenPair?.accessToken.token;

  const handleComplete = useCallback(() => {
    setNextOnboardingStatus();
    loadCurrentUser();
  }, [loadCurrentUser, setNextOnboardingStatus]);

  const handleSkip = useCallback(async () => {
    await skipConnectLinkedinOnboardingStep();
    setNextOnboardingStatus();
    // Do not refetch here: server may not have INSTALL_APP pending yet; refetch
    // would overwrite Recoil with COMPLETED and redirect away from install-app.
  }, [setNextOnboardingStatus, skipConnectLinkedinOnboardingStep]);

  const handleSuccess = useCallback(
    (_data: LinkedinSignupCompleteData) => {
      setSuccess(t`LinkedIn account connected successfully.`);
      setError(null);
      handleComplete();
    },
    [handleComplete, t],
  );

  const handleError = useCallback((err: Error | string) => {
    setError(typeof err === 'string' ? err : err.message);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authResult = params.get('linkedin_auth');
    if (authResult === 'success') {
      setSuccess(t`LinkedIn account connected successfully.`);
      handleComplete();
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authResult === 'failure') {
      setError(t`LinkedIn authentication failed. Please try again.`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [handleComplete, t]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentialsForm.username || !credentialsForm.password) {
      setError(t`Please fill in all required fields`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const service = getLinkedinService();
      const response = await service.connectWithCredentials(
        credentialsForm,
        accessToken,
      );
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
        handleError(response.error ?? t`Failed to connect LinkedIn account`);
      }
    } catch (err) {
      handleError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCookieSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookieForm.access_token || !cookieForm.user_agent) {
      setError(t`Please fill in all required fields`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const service = getLinkedinService();
      const response = await service.connectWithCookie(
        cookieForm,
        accessToken,
      );
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
        handleError(response.error ?? t`Failed to connect LinkedIn account`);
      }
    } catch (err) {
      handleError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleHostedAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const service = getLinkedinService();
      const currentUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
      const response = await service.createHostedAuthLink(
        {
          type: 'create',
          providers: ['LINKEDIN'],
          success_redirect_url: `${currentUrl}?linkedin_auth=success`,
          failure_redirect_url: `${currentUrl}?linkedin_auth=failure`,
        },
        accessToken,
      );
      if (response.success && response.hosted_link) {
        window.location.href = response.hosted_link;
      } else {
        throw new Error('Failed to get hosted auth link');
      }
    } catch (err) {
      handleError(
        err instanceof Error ? err : new Error('Failed to create auth link'),
      );
      setLoading(false);
    }
  };

  const handleCheckpointSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkpointCode || !accountId) {
      setError(t`Please enter the verification code`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const service = getLinkedinService();
      const response = await service.solveCheckpoint(
        {
          account_id: accountId,
          provider: 'LINKEDIN',
          code: checkpointCode,
        },
        accessToken,
      );
      if (response.success && response.data) {
        if (response.data.status === 'checkpoint_required') {
          setAccountId(response.data.account_id ?? accountId);
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
        handleError(response.error ?? t`Failed to verify code`);
      }
    } catch (err) {
      handleError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  if (currentUser?.onboardingStatus !== OnboardingStatus.CONNECT_LINKEDIN) {
    return <></>;
  }

  if (showCheckpoint) {
    return (
      <>
        <Title noMarginTop>
          <Trans>LinkedIn verification</Trans>
        </Title>
        <SubTitle>
          <Trans>
            LinkedIn requires additional verification. Enter the code from your
            email or LinkedIn app.
          </Trans>
        </SubTitle>
        <StyledContentContainer>
          <StyledSectionContainer>
            {error && (
              <StyledMessage variant="error">{error}</StyledMessage>
            )}
            <form onSubmit={handleCheckpointSubmit}>
              <H2Title
                title={t`Verification code`}
                description={t`Enter the code sent to you`}
              />
              <StyledSectionContainer>
                <TextInputV2
                  value={checkpointCode}
                  onChange={(value) => setCheckpointCode(value)}
                  placeholder={t`Enter verification code`}
                  fullWidth
                />
              </StyledSectionContainer>
              <StyledButtonContainer>
                <MainButton
                  title={t`Verify`}
                  onClick={() => {}}
                  type="submit"
                  fullWidth
                  Icon={() => (loading ? <Loader /> : undefined)}
                  disabled={loading}
                />
                <LightButton
                  title={t`Cancel`}
                  accent="tertiary"
                  onClick={() => {
                    setShowCheckpoint(false);
                    handleSkip();
                  }}
                />
              </StyledButtonContainer>
            </form>
          </StyledSectionContainer>
        </StyledContentContainer>
      </>
    );
  }

  return (
    <>
      <Title noMarginTop>
        <Trans>Connect with LinkedIn</Trans>
      </Title>
      <SubTitle>
        <Trans>
          Connect your LinkedIn account to enable messaging, profile insights,
          and networking features. You can skip this step and connect later from
          settings.
        </Trans>
      </SubTitle>
      <StyledContentContainer>
        {error && (
          <StyledSectionContainer>
            <StyledMessage variant="error">{error}</StyledMessage>
          </StyledSectionContainer>
        )}
        {success && (
          <StyledSectionContainer>
            <StyledMessage variant="success">{success}</StyledMessage>
          </StyledSectionContainer>
        )}

        <StyledSectionContainer>
          <StyledTabRow>
            <StyledTab
              type="button"
              active={authMethod === 'credentials'}
              onClick={() => setAuthMethod('credentials')}
            >
              {t`Username / Password`}
            </StyledTab>
            <StyledTab
              type="button"
              active={authMethod === 'hosted'}
              onClick={() => setAuthMethod('hosted')}
            >
              {t`Secure login (recommended)`}
            </StyledTab>
            <StyledTab
              type="button"
              active={authMethod === 'cookie'}
              onClick={() => setAuthMethod('cookie')}
            >
              {t`Cookie / User-Agent`}
            </StyledTab>
          </StyledTabRow>

          {authMethod === 'credentials' && (
            <form onSubmit={handleCredentialsSubmit}>
              <H2Title
                title={t`LinkedIn credentials`}
                description={t`Your login is used only to connect the account and is not stored.`}
              />
              <StyledComboInputContainer>
                <TextInputV2
                  label={t`LinkedIn username or email`}
                  value={credentialsForm.username}
                  onChange={(value) =>
                    setCredentialsForm((prev) => ({ ...prev, username: value }))
                  }
                  placeholder="your.email@example.com"
                  fullWidth
                />
                <TextInputV2
                  label={t`LinkedIn password`}
                  type="password"
                  value={credentialsForm.password}
                  onChange={(value) =>
                    setCredentialsForm((prev) => ({ ...prev, password: value }))
                  }
                  placeholder={t`Your LinkedIn password`}
                  fullWidth
                />
              </StyledComboInputContainer>
              <StyledButtonContainer>
                <MainButton
                  title={t`Connect LinkedIn account`}
                  type="submit"
                  fullWidth
                  Icon={() => (loading ? <Loader /> : undefined)}
                  disabled={loading}
                />
              </StyledButtonContainer>
            </form>
          )}

          {authMethod === 'hosted' && (
            <>
              <StyledMessage variant="info">
                <Trans>
                  Use unipile's authentication wizard for the connection.
                  Supports OAuth, QR codes, 2FA and automatic captcha handling. 
                </Trans>
              </StyledMessage>
              <StyledBenefitsList>
                <li>
                  <Trans>Most secure authentication method</Trans>
                </li>
                <li>
                  <Trans>Automatic captcha solving</Trans>
                </li>
                <li>
                  <Trans>Support for 2FA and OAuth</Trans>
                </li>
                <li>
                  <Trans>QR code scanning for mobile</Trans>
                </li>
                <li>
                  <Trans>No credential storage on your device</Trans>
                </li>
              </StyledBenefitsList>
              <StyledButtonContainer>
                <MainButton
                  title={t`Connect LinkedIn Account`}
                  onClick={handleHostedAuth}
                  fullWidth
                  Icon={() => (loading ? <Loader /> : undefined)}
                  disabled={loading}
                />
              </StyledButtonContainer>
            </>
          )}

          {authMethod === 'cookie' && (
            <form onSubmit={handleCookieSubmit}>
              <H2Title
                title={t`Cookie / User-Agent`}
                description={t`Paste your LinkedIn access token and browser user agent.`}
              />
              <StyledComboInputContainer>
                <TextInputV2
                  label={t`Access token or cookie`}
                  value={cookieForm.access_token}
                  onChange={(value) =>
                    setCookieForm((prev) => ({ ...prev, access_token: value }))
                  }
                  placeholder={t`Paste your LinkedIn access token or cookie value`}
                  fullWidth
                />
                <TextInputV2
                  label={t`User agent`}
                  value={cookieForm.user_agent}
                  onChange={(value) =>
                    setCookieForm((prev) => ({ ...prev, user_agent: value }))
                  }
                  placeholder="Mozilla/5.0 (...)"
                  fullWidth
                />
              </StyledComboInputContainer>
              <StyledButtonContainer>
                <MainButton
                  title={t`Connect with cookie`}
                  type="submit"
                  fullWidth
                  Icon={() => (loading ? <Loader /> : undefined)}
                  disabled={loading}
                />
              </StyledButtonContainer>
            </form>
          )}
        </StyledSectionContainer>
      </StyledContentContainer>
      <StyledSkipContainer>
        <ActionLink onClick={handleSkip}>
          <Trans>Skip</Trans>
        </ActionLink>
      </StyledSkipContainer>
    </>
  );
};
