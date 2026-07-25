import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';

import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

import { LinkedinStoredProfileUnipileActions } from '@/unipile/components/LinkedinStoredProfileUnipileActions';

import {
  getLinkedinCookieSyncSettingsFromPage,
  pingArxChromeExtension,
  setLinkedinCookieSyncConsentFromPage,
} from '../utils/linkedinUnipileExtensionBridge';

const StyledRow = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[3]} 0;
`;

const StyledLabel = styled.label`
  display: flex;
  align-items: flex-start;
  gap: ${themeCssVariables.spacing[2]};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledHint = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  line-height: 1.5;
  margin: 0;
  padding-left: ${themeCssVariables.spacing[6]};
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
  const {
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    enqueueWarningSnackBar,
  } = useSnackBar();
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
        enqueueWarningSnackBar({
          message: t`Install the Arx extension and refresh this page to change this setting.`,
          options: { duration: 6000 },
        });
        return;
      }
      setBusy(true);
      const result = await setLinkedinCookieSyncConsentFromPage(next);
      setBusy(false);
      if (result.ok) {
        setAllowed(next);
        enqueueSuccessSnackBar({ message: t`Saved.` });
      } else {
        enqueueErrorSnackBar({
          message:
            result.error ?? t`Could not update extension settings.`,
        });
      }
    },
    [enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    enqueueWarningSnackBar, extensionReachable, t],
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
