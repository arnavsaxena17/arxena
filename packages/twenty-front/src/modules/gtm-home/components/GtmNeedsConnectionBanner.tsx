import { InformationBanner } from '@/information-banner/components/InformationBanner';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';
import { useLingui } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { IconMail } from 'twenty-ui/icon';

const COMPONENT_INSTANCE_ID = 'information-banner-gtm-needs-connection';

type GtmNeedsConnectionBannerProps = {
  linkedinConnected: boolean;
  gmailConnected: boolean;
  whatsappConnected?: boolean;
};

const formatChannelList = (channels: string[]) => {
  if (channels.length === 1) {
    return channels[0];
  }

  if (channels.length === 2) {
    return `${channels[0]} and ${channels[1]}`;
  }

  return `${channels.slice(0, -1).join(', ')}, and ${channels[channels.length - 1]}`;
};

export const GtmNeedsConnectionBanner = ({
  linkedinConnected,
  gmailConnected,
  whatsappConnected = true,
}: GtmNeedsConnectionBannerProps) => {
  const { t } = useLingui();
  const navigateSettings = useNavigateSettings();
  const missing: string[] = [];

  if (!linkedinConnected) {
    missing.push(t`LinkedIn`);
  }

  if (!gmailConnected) {
    missing.push(t`Gmail`);
  }

  if (!whatsappConnected) {
    missing.push(t`WhatsApp`);
  }

  if (missing.length === 0) {
    return null;
  }

  const channels = formatChannelList(missing);

  return (
    <InformationBanner
      componentInstanceId={COMPONENT_INSTANCE_ID}
      color="danger"
      variant="secondary"
      message={t`Connect ${channels} to start live outreach.`}
      buttonTitle={t`Open accounts`}
      buttonIcon={IconMail}
      buttonOnClick={() => navigateSettings(SettingsPath.Accounts)}
    />
  );
};
