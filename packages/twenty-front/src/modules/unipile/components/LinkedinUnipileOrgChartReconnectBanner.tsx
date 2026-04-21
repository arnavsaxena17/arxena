import styled from '@emotion/styled';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { ARXENA_CHROME_WEBSTORE_URL } from 'twenty-shared';
import { Button } from 'twenty-ui';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { orgChartLinkedinCandidateSourceState } from '@/orgchart/states/orgChartLinkedInCandidateSourceState';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { useUnipile } from '../contexts/UnipileContext';
import { tryExtensionLinkedinUnipileRecovery } from '../utils/linkedinUnipileExtensionBridge';

const LINKEDIN_OPEN_URL = 'https://www.linkedin.com/feed/';

const StyledLinkedinInlineLink = styled.a`
  color: ${({ theme }) => theme.color.blue};
  text-decoration: underline;

  &:hover {
    color: ${({ theme }) => theme.color.blue};
  }
`;

const StyledBanner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  background: ${({ theme }) => theme.background.secondary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  flex-shrink: 0;
`;

export type LinkedinUnipileOrgChartReconnectBannerProps = {
  isExtensionInstalled: boolean;
};

/**
 * Shown on the jobs page when org chart LinkedIn source is Unipile but the workspace
 * has no connected LinkedIn account yet — prompts opening LinkedIn and retrying extension sync.
 */
export const LinkedinUnipileOrgChartReconnectBanner = ({
  isExtensionInstalled,
}: LinkedinUnipileOrgChartReconnectBannerProps) => {
  const { t } = useLingui();
  const orgChartLinkedinSource = useRecoilValue(
    orgChartLinkedinCandidateSourceState,
  );
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token ?? '';
  const { isLinkedinConnected, refreshAccounts } = useUnipile();
  const [isRetrying, setIsRetrying] = useState(false);
  const [linkedinSyncFailedAfterRetry, setLinkedinSyncFailedAfterRetry] =
    useState(false);

  const onOpenChromeWebStore = useCallback(() => {
    window.open(ARXENA_CHROME_WEBSTORE_URL, '_blank', 'noopener,noreferrer');
  }, []);

  const onOpenLinkedin = useCallback(() => {
    window.open(LINKEDIN_OPEN_URL, '_blank', 'noopener,noreferrer');
  }, []);

  const onRetrySync = useCallback(async () => {
    const baseUrl = REACT_APP_SERVER_BASE_URL?.replace(/\/$/, '') ?? '';
    if (!accessToken || !baseUrl) {
      return;
    }
    setIsRetrying(true);
    try {
      const result = await tryExtensionLinkedinUnipileRecovery({
        accessToken,
        serverBaseUrl: baseUrl,
      });
      if (result.ok) {
        setLinkedinSyncFailedAfterRetry(false);
        await refreshAccounts();
      } else if (result.syncAttempted) {
        setLinkedinSyncFailedAfterRetry(true);
      }
    } finally {
      setIsRetrying(false);
    }
  }, [accessToken, refreshAccounts]);

  if (
    orgChartLinkedinSource !== 'unipile' ||
    isLinkedinConnected ||
    !accessToken.trim()
  ) {
    return null;
  }

  return (
    <StyledBanner data-testid="linkedin-unipile-orgchart-reconnect-banner">
      <span>
        {!isExtensionInstalled ? (
          <Trans>
            LinkedIn (Unipile) is not connected. Install the Arx Chrome extension so it can sync your LinkedIn session with Unipile.
          </Trans>
        ) : (
          <Trans>
            LinkedIn (Unipile) is not connected. Open{' '}
            <StyledLinkedinInlineLink
              href="https://www.linkedin.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              linkedin.com
            </StyledLinkedinInlineLink>{' '}
            in this browser, then retry sync so the extension can refresh your
            session.
          </Trans>
        )}
      </span>
      <StyledActions>
        {!isExtensionInstalled ? (
          <Button
            dataTestId="linkedin-unipile-install-chrome-extension"
            title={t`Install Chrome extension`}
            variant="primary"
            accent="blue"
            onClick={onOpenChromeWebStore}
          />
        ) : (
          <>
            <Button
              dataTestId="linkedin-unipile-retry-sync"
              title={t`Retry sync`}
              variant="primary"
              accent="blue"
              onClick={onRetrySync}
              disabled={isRetrying}
            />
            {linkedinSyncFailedAfterRetry ? (
              <Button
                dataTestId="linkedin-unipile-open-linkedin-sign-in"
                title={t`Open LinkedIn and sign in`}
                variant="secondary"
                onClick={onOpenLinkedin}
              />
            ) : null}
          </>
        )}
      </StyledActions>
    </StyledBanner>
  );
};
