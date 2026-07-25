import { useOpenCreateActivityDrawer } from '@/activities/hooks/useOpenCreateActivityDrawer';
import { IconButton } from 'twenty-ui/input';
import { IconPlus } from 'twenty-ui/icon';
import { CoreObjectNameSingular } from 'twenty-shared/types';

export const PageAddChatButton = () => {
  const openCreateActivity = useOpenCreateActivityDrawer({
    activityObjectNameSingular: CoreObjectNameSingular.Task,
  });

  const handleClick = () => {
    openCreateActivity({
      targetableObjects: [],
    });
  };

  return <IconButton Icon={IconPlus} onClick={handleClick} />;
};
