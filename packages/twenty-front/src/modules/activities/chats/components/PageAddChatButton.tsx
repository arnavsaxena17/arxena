import { useOpenCreateActivityDrawer } from '@/activities/hooks/useOpenCreateActivityDrawer';
import { PageAddButton } from '@/ui/layout/page/PageAddButton';

export const PageAddChatButton = () => {
  const openCreateActivity = useOpenCreateActivityDrawer();

  // TODO: fetch workspace member from filter here

  const handleClick = () => {
    openCreateActivity({
      type: 'Chat',
      targetableObjects: [],
    });
  };

  return <PageAddButton onClick={handleClick} />;
};
