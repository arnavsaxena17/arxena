import styled from '@emotion/styled';

import { useTasks } from '@/activities/tasks/hooks/useTasks';
import { ActivityTargetableObject } from '@/activities/types/ActivityTargetableEntity';


const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

type TaskGroupsProps = {
  filterDropdownId?: string;
  targetableObjects?: ActivityTargetableObject[];
  showAddButton?: boolean;
};

export const ChatGroups = ({
  filterDropdownId,
  targetableObjects,
  showAddButton,
}: TaskGroupsProps) => {
  const {
    tasks,
    tasksLoading,
  } = useTasks({
    targetableObjects: targetableObjects ?? [],
  });

  // const openCreateActivity = useOpenCreateActivityDrawer();

  // const { activeTabIdState } = useTabList(TASKS_TAB_LIST_COMPONENT_ID);
  // const activeTabId = useRecoilValue(activeTabIdState);

  if ( tasks?.length === 0) {
    return (

      <>
      </>
    );
  }

  return (

        <>
        </>

  );
};
