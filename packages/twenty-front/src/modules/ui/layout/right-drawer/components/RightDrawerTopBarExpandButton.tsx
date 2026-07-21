import { LightIconButton, UndecoratedLink } from 'twenty-ui';
import { IconExternalLink } from 'twenty-ui/icons';
import { useRightDrawer } from '@/ui/layout/right-drawer/hooks/useRightDrawer';

export const RightDrawerTopBarExpandButton = ({ to }: { to: string }) => {
  const { closeRightDrawer } = useRightDrawer();

  return (
    <UndecoratedLink to={to}>
      <LightIconButton
        size="medium"
        accent="tertiary"
        Icon={IconExternalLink}
        onClick={() => closeRightDrawer()}
      />
    </UndecoratedLink>
  );
};
