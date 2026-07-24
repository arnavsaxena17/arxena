import styled from '@emotion/styled';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';

import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

import { LinkedinStoredProfileUnipileActions } from '@/unipile/components/LinkedinStoredProfileUnipileActions';

import {
  getLinkedinCookieSyncSettingsFromPage,
  pingArxChromeExtension,
  setLinkedinCookieSyncConsentFromPage,
} from '../utils/linkedinUnipileExtensionBridge';

const StyledRow = styled.div`
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(3)} 0;
`;

const StyledLabel = styled.label`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing(2)};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledHint = styled.p`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  line-height: 1.5;
  margin: 0;
  padding-left: ${({ theme }) => theme.spacing(6)};
`;

/**
 * Lets the user allow or deny the Chrome extension reading LinkedIn session cookies for Unipile sync.
 * Requires the Arx extension on this page (same as org chart bridge).
 */
type LinkedinCookieSyncConsentSettingProps = {
  onLinkedinStoredProfileAction?: () => void;
};

export const LinkedinCookieSyncConsentSetting = ({
  onLinkedinStoredProfileAction,
}: LinkedinCookieSyncConsentSettingProps) => {
  const { t } = useLingui();
  const { enqueueSnackBar } = useSnackBar();
  const [allowed, setAllowed] = useState(true);
  const [extensionReachable, setExtensionReachable] = useState<boolean | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const id = await pingArxChromeExtension(2500);
      const reachable = id !== null;
      setExtensionReachable(reachable);
      if (reachable) {
        const s = await getLinkedinCookieSyncSettingsFromPage();
        if (s?.consentGiven === false) {
          setAllowed(false);
        }
        if (s?.consentGiven === true) {
          setAllowed(true);
        }
      }
      setSettingsLoaded(true);
    })();
  }, []);

  const onChange = useCallback(
    async (next: boolean) => {
      if (!extensionReachable) {
        enqueueSnackBar(
          t`Install the Arx extension and refresh this page to change this setting.`,
          { variant: SnackBarVariant.Warning, duration: 6000 },
        );
        return;
      }
      setBusy(true);
      const result = await setLinkedinCookieSyncConsentFromPage(next);
      setBusy(false);
      if (result.ok) {
        setAllowed(next);
        enqueueSnackBar(t`Saved.`, { variant: SnackBarVariant.Success });
      } else {
        enqueueSnackBar(
          result.error ?? t`Could not update extension settings.`,
          { variant: SnackBarVariant.Error },
        );
      }
    },
    [enqueueSnackBar, extensionReachable, t],
  );

  if (extensionReachable === false) {
    return (
      <StyledRow data-testid="linkedin-cookie-sync-consent-unavailable">
        <StyledHint>
          <Trans>
            Install the Arx Chrome extension and refresh this page to manage
            LinkedIn cookie sync for Unipile.
          </Trans>
        </StyledHint>
        <LinkedinStoredProfileUnipileActions
          isCompact
          onAfterChange={onLinkedinStoredProfileAction}
        />
      </StyledRow>
    );
  }

  return (
    <StyledRow data-testid="linkedin-cookie-sync-consent">
      <StyledLabel>
        <input
          type="checkbox"
          checked={allowed}
          disabled={busy || extensionReachable !== true || !settingsLoaded}
          onChange={(e) => {
            void onChange(e.target.checked);
          }}
        />
        <span>
          <Trans>
            Allow automatic LinkedIn session sync (Chrome extension)
          </Trans>
        </span>
      </StyledLabel>
      <StyledHint>
        <Trans>
          When enabled, the extension can send your LinkedIn session to connect
          Unipile without opening the extension popup each time. You stay signed
          in on linkedin.com in this browser profile.
        </Trans>
      </StyledHint>
      <LinkedinStoredProfileUnipileActions
        isCompact
        onAfterChange={onLinkedinStoredProfileAction}
      />
    </StyledRow>
  );
};
