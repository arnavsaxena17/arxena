import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { Button } from 'twenty-ui/input';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { useNavigate } from 'react-router-dom';

const StyledBanner = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.transparent.orange};
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[3]};
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
`;

type GtmNeedsConnectionBannerProps = {
  linkedinConnected: boolean;
  gmailConnected: boolean;
  whatsappConnected?: boolean;
};

export const GtmNeedsConnectionBanner = ({
  linkedinConnected,
  gmailConnected,
  whatsappConnected = true,
}: GtmNeedsConnectionBannerProps) => {
  const navigate = useNavigate();
  const missing: string[] = [];

  if (!linkedinConnected) {
    missing.push('LinkedIn');
  }

  if (!gmailConnected) {
    missing.push('Gmail');
  }

  if (!whatsappConnected) {
    missing.push('WhatsApp');
  }

  if (missing.length === 0) {
    return null;
  }

  return (
    <StyledBanner>
      <span>
        Connect {missing.join(', ')} before live outreach. Candidates stay at
        NEEDS_CONNECTION until channels are ready.
      </span>
      <Button
        title="Open accounts"
        size="small"
        onClick={() => navigate(getSettingsPath(SettingsPath.Accounts))}
      />
    </StyledBanner>
  );
};
