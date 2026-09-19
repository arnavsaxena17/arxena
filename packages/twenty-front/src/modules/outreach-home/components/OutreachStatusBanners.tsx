import { InformationBannerChromeExtensionNotInstalled } from '@/information-banner/components/chrome-extension/InformationBannerChromeExtensionNotInstalled';
import { InformationBanner } from '@/information-banner/components/InformationBanner';
import { informationBannerIsOpenComponentState } from '@/information-banner/states/informationBannerIsOpenComponentState';
import { OutreachNeedsConnectionBanner } from '@/outreach-home/components/OutreachNeedsConnectionBanner';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { useLingui } from '@lingui/react/macro';
import { FeatureFlagKey } from 'twenty-shared/types';

const MOCK_UNIPILE_BANNER_INSTANCE_ID =
  'information-banner-outreach-mock-unipile';

type OutreachStatusBannersProps = {
  linkedinConnected: boolean;
  gmailConnected: boolean;
  whatsappConnected: boolean;
  isExtensionInstalled: boolean;
  isExtensionChecking: boolean;
};

export const OutreachStatusBanners = ({
  linkedinConnected,
  gmailConnected,
  whatsappConnected,
  isExtensionInstalled,
  isExtensionChecking,
}: OutreachStatusBannersProps) => {
  const { t } = useLingui();
  const isMockUnipileEnabled = useIsFeatureEnabled(
    FeatureFlagKey.IS_OUTREACH_MOCK_UNIPILE_ENABLED,
  );
  const setMockUnipileBannerIsOpen = useSetAtomComponentState(
    informationBannerIsOpenComponentState,
    MOCK_UNIPILE_BANNER_INSTANCE_ID,
  );
  const needsConnection =
    !linkedinConnected || !gmailConnected || !whatsappConnected;

  if (needsConnection) {
    return (
      <OutreachNeedsConnectionBanner
        linkedinConnected={linkedinConnected}
        gmailConnected={gmailConnected}
        whatsappConnected={whatsappConnected}
        isMockUnipileEnabled={isMockUnipileEnabled}
      />
    );
  }

  return (
    <>
      {isMockUnipileEnabled && (
        <InformationBanner
          componentInstanceId={MOCK_UNIPILE_BANNER_INSTANCE_ID}
          variant="secondary"
          message={t`Mock Unipile is enabled for this workspace.`}
          onClose={() => setMockUnipileBannerIsOpen(false)}
        />
      )}
      <InformationBannerChromeExtensionNotInstalled
        isExtensionInstalled={isExtensionInstalled}
        isChecking={isExtensionChecking}
      />
    </>
  );
};
