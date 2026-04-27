import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { ARXENA_CHROME_WEBSTORE_URL } from 'twenty-shared';
import { Button } from 'twenty-ui';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { useChromeExtensionDetection } from '@/candidate-table/hooks/useChromeExtensionDetection';
import { useUnipile } from '@/unipile/contexts/UnipileContext';
import {
  fetchUnipileConnectionStatus,
  tryExtensionLinkedinUnipileRecovery,
} from '@/unipile/utils/linkedinUnipileExtensionBridge';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

const LINKEDIN_OPEN_URL = 'https://www.linkedin.com/feed/';

const StyledBanner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
  gap: ${({ theme }) => theme.spacing(1)};
  min-height: 32px;
  padding: 0;
  background: transparent;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledText = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: ${({ theme }) => theme.spacing(1)};
`;

const StyledActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  flex-shrink: 0;
  flex-wrap: nowrap;

  & > * {
    flex: 0 0 auto;
  }
`;

const StyledInlineLink = styled.a`
  color: ${({ theme }) => theme.color.blue};
  text-decoration: underline;

  &:hover {
    color: ${({ theme }) => theme.color.blue};
  }
`;

type AutoConnectPhase = 'idle' | 'attempting' | 'failed';

const POLL_MIN_INTERVAL_MS = 90_000;

export const InformationBannerLinkedinUnipileAutoConnect = () => {
  const { t } = useLingui();
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token ?? '';
  const baseUrl = REACT_APP_SERVER_BASE_URL?.replace(/\/$/, '') ?? '';

  const { isLinkedinConnected, refreshAccounts } = useUnipile();
  const { isExtensionInstalled, isChecking } = useChromeExtensionDetection();
  const [autoConnectEnabled, setAutoConnectEnabled] = useState<boolean | null>(
    null,
  );
  const [phase, setPhase] = useState<AutoConnectPhase>('idle');

  const inFlightRef = useRef(false);
  const lastAttemptAtRef = useRef(0);
  const timeoutIdRef = useRef<number | null>(null);

  const canEvaluate = useMemo(() => {
    return Boolean(accessToken.trim() && baseUrl.trim());
  }, [accessToken, baseUrl]);

  const shouldShowBanner = useMemo(() => {
    if (!canEvaluate) {
      return false;
    }
    if (isLinkedinConnected) {
      return false;
    }
    if (autoConnectEnabled !== true) {
      return false;
    }
    return true;
  }, [autoConnectEnabled, canEvaluate, isLinkedinConnected]);

  useEffect(() => {
    // Useful for debugging "banner not showing" reports.
    // eslint-disable-next-line no-console
    console.log('[LinkedinUnipileAutoConnectBanner]', {
      canEvaluate,
      hasAccessToken: Boolean(accessToken.trim()),
      baseUrl,
      isLinkedinConnected,
      autoConnectEnabled,
      isExtensionInstalled,
      isChecking,
      phase,
      shouldShowBanner,
    });
  }, [
    accessToken,
    autoConnectEnabled,
    baseUrl,
    canEvaluate,
    isChecking,
    isExtensionInstalled,
    isLinkedinConnected,
    phase,
    shouldShowBanner,
  ]);

  const openChromeWebStore = useCallback(() => {
    window.open(ARXENA_CHROME_WEBSTORE_URL, '_blank', 'noopener,noreferrer');
  }, []);

  const openLinkedin = useCallback(() => {
    window.open(LINKEDIN_OPEN_URL, '_blank', 'noopener,noreferrer');
  }, []);

  const reloadArxenaTab = useCallback(() => {
    window.location.reload();
  }, []);

  const runRecoveryAttempt = useCallback(async () => {
    if (!canEvaluate) {
      return;
    }
    if (isLinkedinConnected) {
      return;
    }
    if (inFlightRef.current) {
      return;
    }
    if (document.visibilityState !== 'visible') {
      return;
    }
    const now = Date.now();
    if (now - lastAttemptAtRef.current < POLL_MIN_INTERVAL_MS) {
      return;
    }
    lastAttemptAtRef.current = now;

    inFlightRef.current = true;
    setPhase('attempting');
    try {
      const result = await tryExtensionLinkedinUnipileRecovery({
        accessToken,
        serverBaseUrl: baseUrl,
      });
      if (result.ok) {
        await refreshAccounts();
        setPhase('idle');
      } else {
        setPhase('failed');
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [accessToken, baseUrl, canEvaluate, isLinkedinConnected, refreshAccounts]);

  useEffect(() => {
    if (!canEvaluate) {
      setAutoConnectEnabled(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const status = await fetchUnipileConnectionStatus(accessToken, baseUrl);
      if (cancelled) {
        return;
      }
      setAutoConnectEnabled(
        status ? status.connectLinkedinToUnipileAutomatically : null,
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, baseUrl, canEvaluate]);

  useEffect(() => {
    if (!shouldShowBanner) {
      if (timeoutIdRef.current != null) {
        window.clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      return;
    }

    const tick = async () => {
      timeoutIdRef.current = null;
      if (!shouldShowBanner) {
        return;
      }
      if (document.visibilityState !== 'visible') {
        timeoutIdRef.current = window.setTimeout(tick, 5000);
        return;
      }
      if (isExtensionInstalled && !isChecking) {
        await runRecoveryAttempt();
      }
      timeoutIdRef.current = window.setTimeout(tick, 15_000);
    };

    timeoutIdRef.current = window.setTimeout(tick, 2000);

    return () => {
      if (timeoutIdRef.current != null) {
        window.clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    };
  }, [
    isChecking,
    isExtensionInstalled,
    runRecoveryAttempt,
    shouldShowBanner,
  ]);

  if (!shouldShowBanner) {
    return null;
  }

  const bannerText = (() => {
    if (!isExtensionInstalled) {
      return t`LinkedIn (Unipile) is not connected. Install/enable the Arx Chrome extension, then reload this Arxena tab so it can sync your LinkedIn session.`;
    }
    if (phase === 'failed') {
      return t`LinkedIn (Unipile) is not connected. Open LinkedIn in this browser, sign in, then retry sync.`;
    }
    return t`LinkedIn (Unipile) is not connected. Open LinkedIn in this browser, sign in, then retry sync.`;
  })();

  return (
    <StyledBanner data-testid="information-banner-linkedin-unipile-autoconnect">
      <StyledText>
        {bannerText}{' '}
        {isExtensionInstalled ? (
          <StyledInlineLink href="https://www.linkedin.com/" target="_blank" rel="noopener noreferrer" >
            linkedin.com
          </StyledInlineLink>
        ) : null}
      </StyledText>
      <StyledActions>
        {!isExtensionInstalled ? (
          <>
            <Button
              dataTestId="linkedin-unipile-install-extension"
              title={t`Install extension`}
              size="small"
              variant="primary"
              accent="blue"
              onClick={openChromeWebStore}
              disabled={isChecking || phase === 'attempting'}
            />
            <Button
              dataTestId="linkedin-unipile-reload-tab"
              title={t`Reload tab`}
              size="small"
              variant="secondary"
              onClick={reloadArxenaTab}
              disabled={isChecking || phase === 'attempting'}
            />
          </>
        ) : (
          <>
            <Button
              dataTestId="linkedin-unipile-retry-sync-global"
              title={t`Retry sync`}
              size="small"
              variant="primary"
              accent="blue"
              onClick={runRecoveryAttempt}
              disabled={isChecking || phase === 'attempting'}
            />
            <Button
              dataTestId="linkedin-unipile-open-linkedin-global"
              title={t`Open LinkedIn`}
              size="small"
              variant="secondary"
              onClick={openLinkedin}
              disabled={isChecking || phase === 'attempting'}
            />
          </>
        )}
      </StyledActions>
    </StyledBanner>
  );
};

