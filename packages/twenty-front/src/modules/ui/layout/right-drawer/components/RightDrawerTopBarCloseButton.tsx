

import { LightIconButton } from 'twenty-ui';
import { IconX } from 'twenty-ui/icons';
import { useRightDrawer } from '../hooks/useRightDrawer';

export const RightDrawerTopBarCloseButton = () => {
  const { closeRightDrawer } = useRightDrawer();

  const handleButtonClick = () => {
    closeRightDrawer();
  };

  return (
    <LightIconButton
      Icon={IconX}
      onClick={handleButtonClick}
      size="medium"
      accent="tertiary"
    />
  );
};
