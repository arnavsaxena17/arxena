import { useOpenCreateActivityDrawer } from '@/activities/hooks/useOpenCreateActivityDrawer';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
// import { PageAddButton } from '@ui/layout/page/PageAddButton';
import { PageAddButton } from '@/ui/layout/page/components/PageAddButton';

export const PageAddChatButton = () => {
  const openCreateActivity = useOpenCreateActivityDrawer({activityObjectNameSingular: CoreObjectNameSingular.Task});

  // TODO: fetch workspace member from filter here

  const handleClick = () => {
    openCreateActivity({
      targetableObjects: [],
    });
  };

  return <PageAddButton onClick={handleClick} />;
};
