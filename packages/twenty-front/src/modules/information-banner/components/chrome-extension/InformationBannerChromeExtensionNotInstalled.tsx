import { InformationBanner } from '@/information-banner/components/InformationBanner';
import { informationBannerIsOpenComponentState } from '@/information-banner/states/informationBannerIsOpenComponentState';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { useLingui } from '@lingui/react/macro';
import { ARXENA_CHROME_WEBSTORE_URL } from 'twenty-shared/constants';
import { IconBrowserMaximize } from 'twenty-ui/icon';

const COMPONENT_INSTANCE_ID =
  'information-banner-chrome-extension-not-installed';

export type InformationBannerChromeExtensionNotInstalledProps = {
  isExtensionInstalled: boolean;
  isChecking?: boolean;
};

export const InformationBannerChromeExtensionNotInstalled = ({
  isExtensionInstalled,
  isChecking = false,
}: InformationBannerChromeExtensionNotInstalledProps) => {
  const { t } = useLingui();
  const setInformationBannerIsOpen = useSetAtomComponentState(
    informationBannerIsOpenComponentState,
    COMPONENT_INSTANCE_ID,
  );

  if (isChecking || isExtensionInstalled) {
    return null;
  }

  return (
    <InformationBanner
      componentInstanceId={COMPONENT_INSTANCE_ID}
      color="blue"
      variant="secondary"
      message={t`Install the Arx Chrome extension to sync LinkedIn.`}
      buttonTitle={t`Install extension`}
      buttonIcon={IconBrowserMaximize}
      buttonOnClick={() => {
        window.open(ARXENA_CHROME_WEBSTORE_URL, '_blank', 'noopener,noreferrer');
      }}
      onClose={() => setInformationBannerIsOpen(false)}
    />
  );
};
