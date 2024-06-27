import styled from "@emotion/styled";
import { IconArchive, IconCheck, IconCheckbox } from "twenty-ui";

import { TasksRecoilScopeContext } from "@/activities/states/recoil-scope-contexts/TasksRecoilScopeContext";
import { PageAddTaskButton } from "@/activities/tasks/components/PageAddTaskButton";
import { TaskGroups } from "@/activities/tasks/components/TaskGroups";
import { TASKS_TAB_LIST_COMPONENT_ID } from "@/activities/tasks/constants/TasksTabListComponentId";
import { ObjectFilterDropdownButton } from "@/object-record/object-filter-dropdown/components/ObjectFilterDropdownButton";
import { RecordFieldValueSelectorContextProvider } from "@/object-record/record-store/contexts/RecordFieldValueSelectorContext";
import { RelationPickerHotkeyScope } from "@/object-record/relation-picker/types/RelationPickerHotkeyScope";
import { PageBody } from "@/ui/layout/page/PageBody";
import { PageContainer } from "@/ui/layout/page/PageContainer";
import { PageHeader } from "@/ui/layout/page/PageHeader";
import { TabList } from "@/ui/layout/tab/components/TabList";
import { TopBar } from "@/ui/layout/top-bar/TopBar";
import { RecoilScope } from "@/ui/utilities/recoil-scope/components/RecoilScope";

import { TasksEffect } from "./TasksEffect";
import ChatMain from "@/activities/chats/components/ChatMain";

const StyledTasksContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  overflow: auto;
`;

const StyledTabListContainer = styled.div`
  align-items: end;
  display: flex;
  height: 40px;
`;

export const Chats = () => {
  const TASK_TABS = [
    {
      id: "to-do",
      title: "To do",
      Icon: IconCheck,
    },
    {
      id: "done",
      title: "Done",
      Icon: IconArchive,
    },
  ];

  const filterDropdownId = "tasks-assignee-filter";

  return (
    <PageContainer>
      <RecordFieldValueSelectorContextProvider>
        <RecoilScope CustomRecoilScopeContext={TasksRecoilScopeContext}>
          <TasksEffect filterDropdownId={filterDropdownId} />
          <PageHeader title="Chats" Icon={IconCheckbox}>
            <PageAddTaskButton />
          </PageHeader>
          <PageBody>
            <div>Hehlllooooo</div>

            {/* <TaskGroups filterDropdownId={filterDropdownId} /> */}
            <ChatMain />
          </PageBody>
        </RecoilScope>
      </RecordFieldValueSelectorContextProvider>
    </PageContainer>
  );
};
