import { useLingui } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';

import { InformationBanner } from '@/information-banner/components/InformationBanner';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';

export type InformationBannerNoMoreArxenaCreditsKind =
  | 'maps'
  | 'reveals'
  | 'api';

type InformationBannerNoMoreArxenaCreditsProps = {
  kinds: InformationBannerNoMoreArxenaCreditsKind[];
};

export const InformationBannerNoMoreArxenaCredits = ({
  kinds,
}: InformationBannerNoMoreArxenaCreditsProps) => {
  const { t } = useLingui();
  const navigateSettings = useNavigateSettings();

  if (kinds.length === 0) {
    return null;
  }

  const labelByKind: Record<InformationBannerNoMoreArxenaCreditsKind, string> =
    {
      maps: t`map`,
      reveals: t`reveal`,
      api: t`API`,
    };

  const labels = kinds.map((kind) => labelByKind[kind]);
  const creditKindsLabel =
    labels.length === 1
      ? t`${labels[0]} credits`
      : labels.length === 2
        ? t`${labels[0]} and ${labels[1]} credits`
        : t`${labels[0]}, ${labels[1]}, and ${labels[2]} credits`;

  return (
    <InformationBanner
      componentInstanceId="information-banner-no-more-arxena-credits"
      color="danger"
      variant="secondary"
      message={t`You've run out of ${creditKindsLabel}. Buy a top-up to continue.`}
      buttonTitle={t`Buy credits`}
      buttonOnClick={() => navigateSettings(SettingsPath.Billing)}
    />
  );
};
