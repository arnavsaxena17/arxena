import { InformationBanner } from '@/information-banner/components/InformationBanner';
import { informationBannerIsOpenComponentState } from '@/information-banner/states/informationBannerIsOpenComponentState';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { useLingui } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { IconMail } from 'twenty-ui/icon';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';

const COMPONENT_INSTANCE_ID = 'information-banner-outreach-needs-connection';

type OutreachNeedsConnectionBannerProps = {
  linkedinConnected: boolean;
  gmailConnected: boolean;
  whatsappConnected?: boolean;
  isMockUnipileEnabled?: boolean;
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

export const OutreachNeedsConnectionBanner = ({
  linkedinConnected,
  gmailConnected,
  whatsappConnected = true,
  isMockUnipileEnabled = false,
}: OutreachNeedsConnectionBannerProps) => {
  const { t } = useLingui();
  const navigateSettings = useNavigateSettings();
  const setInformationBannerIsOpen = useSetAtomComponentState(
    informationBannerIsOpenComponentState,
    COMPONENT_INSTANCE_ID,
  );
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
  const message = isMockUnipileEnabled
    ? t`Mock Unipile is enabled for this workspace. Connect ${channels} to start live outreach.`
    : t`Connect ${channels} to start live outreach.`;

  return (
    <InformationBanner
      componentInstanceId={COMPONENT_INSTANCE_ID}
      color="blue"
      variant="secondary"
      message={message}
      buttonTitle={t`Open accounts`}
      buttonIcon={IconMail}
      buttonOnClick={() => navigateSettings(SettingsPath.Accounts)}
      onClose={() => setInformationBannerIsOpen(false)}
    />
  );
};
