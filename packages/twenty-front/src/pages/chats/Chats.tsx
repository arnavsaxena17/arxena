import styled from "@emotion/styled";
import { useParams } from 'react-router-dom';

import { IconArchive, IconCheck, IconCheckbox } from "twenty-ui";

import { TasksRecoilScopeContext } from "@/activities/states/recoil-scope-contexts/TasksRecoilScopeContext";
import { PageAddChatButton } from "@/activities/chats/components/PageAddChatButton";
// import { TaskGroups } from "@/activities/chats/components/TaskGroups";
// import { TASKS_TAB_LIST_COMPONENT_ID } from "@/activities/tasks/constants/TasksTabListComponentId";
// import { ObjectFilterDropdownButton } from "@/object-record/object-filter-dropdown/components/ObjectFilterDropdownButton";
import { RecordFieldValueSelectorContextProvider } from "@/object-record/record-store/contexts/RecordFieldValueSelectorContext";
import { RelationPickerHotkeyScope } from "@/object-record/relation-picker/types/RelationPickerHotkeyScope";
import { PageBody } from "@/ui/layout/page/PageBody";
import { PageContainer } from "@/ui/layout/page/PageContainer";
import { PageHeader } from "@/ui/layout/page/PageHeader";
// import { TabList } from "@/ui/layout/tab/components/TabList";
import { TopBar } from "@/ui/layout/top-bar/TopBar";
import { RecoilScope } from "@/ui/utilities/recoil-scope/components/RecoilScope";

import ChatMain from "@/activities/chats/components/ChatMain";


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
  flex-shrink: 0;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  
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
    min-height: calc(100vh - 160px); // Adjust based on your header + topbar height
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
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

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



export const Chats = () => {
  const { candidateId } = useParams<{ candidateId: string }>();

  return (
    <StyledPageContainer>
      <RecordFieldValueSelectorContextProvider>
        <RecoilScope CustomRecoilScopeContext={TasksRecoilScopeContext}>
          <StyledPageHeader title="Chats" Icon={IconCheckbox}>
            <StyledAddButtonWrapper>
              <PageAddChatButton />
            </StyledAddButtonWrapper>
          </StyledPageHeader>
          <StyledPageBody>
            <StyledTopBar 
              leftComponent={
                <StyledTabListContainer>
                  {/* Add any tab components here */}
                </StyledTabListContainer>
              } 
              showRefetch={false} 
            />
            <StyledChatMainWrapper>
              <ChatMain initialCandidateId={candidateId} />
            </StyledChatMainWrapper>
          </StyledPageBody>
        </RecoilScope>
      </RecordFieldValueSelectorContextProvider>
    </StyledPageContainer>
  );
};
