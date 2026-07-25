import { useCallback, useState } from 'react';
import QRCode from 'react-qr-code';
import axios from 'axios';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useBaileys } from '@/baileys/contexts/BaileysContext';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useLingui } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Button } from 'twenty-ui/input';
import { H2Title } from 'twenty-ui/typography';
import { Section } from 'twenty-ui/layout';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

const StyledQrSection = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  padding: ${themeCssVariables.spacing[4]} 0;
`;

const StyledMessage = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  margin: 0;
  text-align: center;
`;

const StyledRecruiterInfo = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
  text-align: center;
`;

export const BaileysAccounts = () => {
  const { t } = useLingui();
  const { qrCode, isBaileysLoggedIn, recruiterDetails, socket } = useBaileys();
  const tokenPair = useAtomStateValue(tokenPairState);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    if (!socket || !tokenPair?.accessOrWorkspaceAgnosticToken?.token) {
      enqueueErrorSnackBar({
        message: t`WhatsApp socket connection not available`,
      });
      return;
    }

    try {
      setIsLoggingOut(true);
      const response = await axios.post(
        `${REACT_APP_SERVER_BASE_URL}/baileys-whatsapp/logout`,
        {
          sessionId: tokenPair.accessOrWorkspaceAgnosticToken.token,
          origin: window.location.origin,
        },
        {
          headers: {
            Authorization: `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`,
          },
        },
      );

      if (response.data.status === 'ok') {
        localStorage.setItem('whatsapp_logged_out', 'true');
        enqueueSuccessSnackBar({
          message: t`Successfully logged out from WhatsApp`,
        });
      } else {
        throw new Error(response.data.message || 'WhatsApp logout failed');
      }
    } catch (error) {
      console.error('Error during WhatsApp logout:', error);
      enqueueErrorSnackBar({
        message: t`Failed to logout from WhatsApp`,
      });
    } finally {
      setIsLoggingOut(false);
    }
  }, [
    enqueueErrorSnackBar,
    enqueueSuccessSnackBar,
    socket,
    t,
    tokenPair?.accessOrWorkspaceAgnosticToken?.token,
  ]);

  const renderConnectionContent = () => {
    if (isBaileysLoggedIn && !qrCode) {
      return (
        <StyledQrSection>
          <StyledMessage>{t`Your WhatsApp is connected.`}</StyledMessage>
          {recruiterDetails?.name && recruiterDetails?.id && (
            <StyledRecruiterInfo>
              {t`Connected as:`} {recruiterDetails.name} ({recruiterDetails.id})
            </StyledRecruiterInfo>
          )}
          <Button
            title={isLoggingOut ? t`Disconnecting...` : t`Disconnect WhatsApp`}
            onClick={handleLogout}
            disabled={isLoggingOut}
            variant="secondary"
          />
        </StyledQrSection>
      );
    }

    if (qrCode) {
      return (
        <StyledQrSection>
          <QRCode value={qrCode} />
          <StyledMessage>
            {t`Scan this QR code with WhatsApp to connect`}
          </StyledMessage>
          {isBaileysLoggedIn && (
            <StyledMessage>
              {t`Reconnection QR — your session may be reconnecting`}
            </StyledMessage>
          )}
        </StyledQrSection>
      );
    }

    return (
      <StyledQrSection>
        <StyledMessage>
          {isLoggingOut
            ? t`Preparing new QR code...`
            : t`Loading WhatsApp QR code...`}
        </StyledMessage>
      </StyledQrSection>
    );
  };

  return (
    <SettingsPageLayout
      title={t`Baileys`}
      links={[
        {
          children: t`User`,
          href: getSettingsPath(SettingsPath.ProfilePage),
        },
        {
          children: t`Accounts`,
          href: getSettingsPath(SettingsPath.Accounts),
        },
        { children: t`Baileys` },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <H2Title
            title={t`WhatsApp (Baileys)`}
            description={t`Connect a personal WhatsApp session via QR code.`}
          />
          {renderConnectionContent()}
        </Section>
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
