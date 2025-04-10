import styled from '@emotion/styled';

import { Button, IconCheckbox, IconFilter, IconPlus } from 'twenty-ui';

import { ChatOptionsDropdownButton } from '@/activities/chats/components/ChatOptionsDropdownButton';
import { PageAddChatButton } from '@/activities/chats/components/PageAddChatButton';
import { ObjectFilterDropdownButton } from '@/object-record/object-filter-dropdown/components/ObjectFilterDropdownButton';
import { ObjectFilterDropdownComponentInstanceContext } from '@/object-record/object-filter-dropdown/states/contexts/ObjectFilterDropdownComponentInstanceContext';
import { FiltersHotkeyScope } from '@/object-record/object-filter-dropdown/types/FiltersHotkeyScope';
import { ObjectSortDropdownButton } from '@/object-record/object-sort-dropdown/components/ObjectSortDropdownButton';
import { ObjectSortDropdownComponentInstanceContext } from '@/object-record/object-sort-dropdown/states/context/ObjectSortDropdownComponentInstanceContext';
import { RecordIndexContextProvider } from '@/object-record/record-index/contexts/RecordIndexContext';
import { RecordFieldValueSelectorContextProvider } from '@/object-record/record-store/contexts/RecordFieldValueSelectorContext';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { ViewComponentInstanceContext } from '@/views/states/contexts/ViewComponentInstanceContext';
// import { TasksRecoilScopeContext } from "@/activities/states/recoil-scope-contexts/TasksRecoilScopeContext";
// import { TaskGroups } from "@/activities/chats/components/TaskGroups";
// import { TASKS_TAB_LIST_COMPONENT_ID } from "@/activities/tasks/constants/TasksTabListComponentId";
// import { ObjectFilterDropdownButton } from "@/object-record/object-filter-dropdown/components/ObjectFilterDropdownButton";
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
// import { TabList } from "@/ui/layout/tab/components/TabList";
import { TopBar } from '@/ui/layout/top-bar/components/TopBar';

import { ChatMain } from '@/activities/chats/components/ChatMain';

const StyledPageContainer = styled(PageContainer)`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  overflow: hidden;

  @media (max-width: 768px) {
    height: 100%;
    min-height: 100vh;
  }
`;

const StyledPageHeader = styled(PageHeader)`
  flex-shrink: 0;
  padding: 12px 24px;

  @media (max-width: 768px) {
    padding: 8px 16px;
  }
`;

const StyledPageBody = styled(PageBody)`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  position: relative;

  @media (max-width: 768px) {
    overflow: auto;
  }
`;

const StyledTopBar = styled(TopBar)`
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  flex-shrink: 0;

  @media (max-width: 768px) {
    position: sticky;
    top: 0;
    z-index: 10;
    background: white;
  }
`;

const StyledTabListContainer = styled.div`
  align-items: end;
  display: flex;
  height: 40px;
  padding: 0 16px;

  @media (max-width: 768px) {
    height: 32px;
    padding: 0 8px;
  }
`;

const StyledChatMainWrapper = styled.div`
  flex: 1;
  overflow: hidden;
  position: relative;

  @media (max-width: 768px) {
    min-height: calc(
      100vh - 160px
    ); // Adjust based on your header + topbar height
  }
`;

const StyledAddButtonWrapper = styled.div`
  @media (max-width: 768px) {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 100;

    button {
      border-radius: 50%;
      width: 56px;
      height: 56px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px ${({ theme }) => theme.border.color.light};

      span {
        display: none;
      }

      svg {
        width: 24px;
        height: 24px;
      }
    }
  }
`;

const StyledRightSection = styled.div`
  display: flex;
  font-weight: ${({ theme }) => theme.font.weight.regular};
  gap: ${({ theme }) => theme.betweenSiblingsGap};
`;

export const Chats = () => {
  // const { candidateId } = useParams<{ candidateId: string }>();
  const candidateId = '1'; // Replace with your candidateId
  const filterDropdownId = 'chat-filter'; // Define a unique ID for the filter dropdown
  const recordIndexId = 'chats'; // Define a unique ID for the record index context (adjust if needed)

  // TODO: Get objectMetadataItem and viewType dynamically if needed for ObjectOptionsDropdown
  const mockObjectMetadataItem = { nameSingular: 'chat' }; // Placeholder
  const mockViewType = 'Table'; // Placeholder, should ideally come from state

  // Placeholder value for RecordIndexContext
  const recordIndexContextValue = {
    indexIdentifierUrl: (recordId: string) => `/chats/${recordId}`, // Adjust URL path as needed
    onIndexRecordsLoaded: () => {},
    objectNamePlural: 'chats',
    objectNameSingular: 'chat',
    objectMetadataItem: mockObjectMetadataItem as any, // Use placeholder, cast as any
    recordIndexId: recordIndexId,
  };

  return (
    <StyledPageContainer>
      <RecordFieldValueSelectorContextProvider>
        {/* <RecoilScope CustomRecoilScopeContext={TasksRecoilScopeContext}> */}
        <StyledPageHeader title="Chats" Icon={IconCheckbox}>

        <Button
            title="Filter"
            Icon={IconFilter}
            variant="secondary"
            onClick={() => {}}
          />
          <Button
            title="Add Job"
            Icon={IconPlus}
            variant="primary"
            onClick={() => {}}
          />
          <StyledAddButtonWrapper>
            <PageAddChatButton />



          </StyledAddButtonWrapper>
        </StyledPageHeader>
        <StyledPageBody>
          {/* Provide RecordIndexContext */}
          <RecordIndexContextProvider value={recordIndexContextValue}>
            {/* Provide ViewComponentInstanceContext needed by sort state */}
            <ViewComponentInstanceContext.Provider
              value={{ instanceId: recordIndexId }} // Using recordIndexId as viewBarId
            >
              <StyledTopBar
                leftComponent={
                  <StyledTabListContainer>
                    {/* Add any tab components here */}
                  </StyledTabListContainer>
                }
                rightComponent={
                  <StyledRightSection>
                    {/* Provide context for the filter dropdown */}
                    <ObjectFilterDropdownComponentInstanceContext.Provider
                      value={{ instanceId: filterDropdownId }}
                    >
                      <ObjectFilterDropdownButton
                        filterDropdownId={filterDropdownId}
                        hotkeyScope={{
                          scope: FiltersHotkeyScope.ObjectFilterDropdownButton,
                        }}
                      />
                    </ObjectFilterDropdownComponentInstanceContext.Provider>
                    {/* Provide context directly for the sort dropdown */}
                    <ObjectSortDropdownComponentInstanceContext.Provider
                      value={{ instanceId: recordIndexId }}
                    >
                      <ObjectSortDropdownButton
                        hotkeyScope={{
                          scope: FiltersHotkeyScope.ObjectSortDropdownButton, // Assuming similar hotkey scope for sort
                        }}
                      />
                    </ObjectSortDropdownComponentInstanceContext.Provider>
                    {/* Use the custom chat options dropdown */}
                    <ChatOptionsDropdownButton />
                  </StyledRightSection>
                }
              />
            </ViewComponentInstanceContext.Provider>
          </RecordIndexContextProvider>
          <StyledChatMainWrapper>
            <ChatMain initialCandidateId={candidateId} />
          </StyledChatMainWrapper>
        </StyledPageBody>
        {/* </RecoilScope> */}
      </RecordFieldValueSelectorContextProvider>
    </StyledPageContainer>
  );
};
