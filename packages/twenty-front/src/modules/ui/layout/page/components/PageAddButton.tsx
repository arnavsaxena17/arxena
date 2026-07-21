import { Button, IconButton, useIsMobile } from 'twenty-ui';
import { IconPlus } from 'twenty-ui/icons';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { useLingui } from '@lingui/react/macro';

import { FeatureFlagKey } from '~/generated/graphql';

type PageAddButtonProps = {
  onClick?: () => void;
};

export const PageAddButton = ({ onClick }: PageAddButtonProps) => {
  const isCommandMenuV2Enabled = useIsFeatureEnabled(
    FeatureFlagKey.IsCommandMenuV2Enabled,
  );
  const isMobile = useIsMobile();

  const { t } = useLingui();

  return (
    <>
      {isCommandMenuV2Enabled ? (
        <Button
          Icon={IconPlus}
          dataTestId="add-button"
          size={isMobile ? 'medium' : 'small'}
          variant="secondary"
          accent="default"
          title={isMobile ? '' : t`New record`}
          onClick={onClick}
          ariaLabel={t`New record`}
        />
      ) : (
        <IconButton
          Icon={IconPlus}
          dataTestId="add-button"
          size="medium"
          variant="secondary"
          accent="default"
          ariaLabel={t`Add`}
          onClick={onClick}
        />
      )}
    </>
  );
};
