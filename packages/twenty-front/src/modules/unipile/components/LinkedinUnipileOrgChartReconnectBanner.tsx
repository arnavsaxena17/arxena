import styled from '@emotion/styled';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { orgChartLinkedinCandidateSourceState } from '@/orgchart/states/orgChartLinkedInCandidateSourceState';
import { Button } from 'twenty-ui';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { useUnipile } from '../contexts/UnipileContext';
import { tryExtensionLinkedinUnipileRecovery } from '../utils/linkedinUnipileExtensionBridge';

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

/**
 * Shown on the jobs page when org chart LinkedIn source is Unipile but the workspace
 * has no connected LinkedIn account yet — prompts opening LinkedIn and retrying extension sync.
 */
export const LinkedinUnipileOrgChartReconnectBanner = () => {
  const { t } = useLingui();
  const orgChartLinkedinSource = useRecoilValue(
    orgChartLinkedinCandidateSourceState,
  );
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token ?? '';
  const { isLinkedinConnected, refreshAccounts } = useUnipile();
  const [isRetrying, setIsRetrying] = useState(false);

  const onOpenLinkedin = useCallback(() => {
    window.open('https://www.linkedin.com/feed/', '_blank', 'noopener,noreferrer');
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
        await refreshAccounts();
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
        <Trans>
          LinkedIn (Unipile) is not connected. Open LinkedIn in this browser, then
          retry sync so the extension can refresh your session.
        </Trans>
      </span>
      <StyledActions>
        <Button
          title={t`Open LinkedIn in a new tab`}
          variant="secondary"
          onClick={onOpenLinkedin}
        >
          <Trans>Open LinkedIn</Trans>
        </Button>
        <Button
          title={t`Retry syncing via the Chrome extension`}
          variant="primary"
          onClick={onRetrySync}
          disabled={isRetrying}
        >
          <Trans>Retry sync</Trans>
        </Button>
      </StyledActions>
    </StyledBanner>
  );
};
