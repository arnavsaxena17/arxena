import { InformationBannerChromeExtensionNotInstalled } from '@/information-banner/components/chrome-extension/InformationBannerChromeExtensionNotInstalled';
import { InformationBanner } from '@/information-banner/components/InformationBanner';
import { OutreachNeedsConnectionBanner } from '@/outreach-home/components/OutreachNeedsConnectionBanner';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { useLingui } from '@lingui/react/macro';
import { FeatureFlagKey } from 'twenty-shared/types';

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
  const needsConnection =
    !linkedinConnected || !gmailConnected || !whatsappConnected;

  return (
    <>
      {isMockUnipileEnabled && (
        <InformationBanner
          componentInstanceId="information-banner-outreach-mock-unipile"
          variant="secondary"
          message={t`Mock Unipile is enabled for this workspace.`}
        />
      )}
      {needsConnection ? (
        <OutreachNeedsConnectionBanner
          linkedinConnected={linkedinConnected}
          gmailConnected={gmailConnected}
          whatsappConnected={whatsappConnected}
        />
      ) : (
        <InformationBannerChromeExtensionNotInstalled
          isExtensionInstalled={isExtensionInstalled}
          isChecking={isExtensionChecking}
        />
      )}
    </>
  );
};
