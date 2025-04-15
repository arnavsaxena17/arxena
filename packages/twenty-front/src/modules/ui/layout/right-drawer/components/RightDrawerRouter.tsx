import styled from '@emotion/styled';
import { useRecoilState, useRecoilValue } from 'recoil';

import { RightDrawerCalendarEvent } from '@/activities/calendar/right-drawer/components/RightDrawerCalendarEvent';
import { RightDrawerAIChat } from '@/activities/copilot/right-drawer/components/RightDrawerAIChat';
import { RightDrawerEmailThread } from '@/activities/emails/right-drawer/components/RightDrawerEmailThread';
import { RightDrawerRecord } from '@/object-record/record-right-drawer/components/RightDrawerRecord';
import { isRightDrawerMinimizedState } from '@/ui/layout/right-drawer/states/isRightDrawerMinimizedState';

import { RightDrawerAllActionsContent } from '@/action-menu/components/RightDrawerAllActionsContent';
import { CandidateChatDrawer } from '@/activities/chats/components/CandidateChatDrawer';
import { RightDrawerChatAllActionsContent } from '@/activities/chats/components/RightDrawerChatAllActionsContent';
import { SimpleActivityDrawer } from '@/activities/chats/components/SimpleActivityDrawer';
import { RightDrawerContainer } from '@/ui/layout/right-drawer/components/RightDrawerContainer';
import { RightDrawerTopBar } from '@/ui/layout/right-drawer/components/RightDrawerTopBar';
import { ComponentByRightDrawerPage } from '@/ui/layout/right-drawer/types/ComponentByRightDrawerPage';
import { RightDrawerWorkflowEditStep } from '@/workflow/workflow-steps/components/RightDrawerWorkflowEditStep';
import { RightDrawerWorkflowViewStep } from '@/workflow/workflow-steps/components/RightDrawerWorkflowViewStep';
import { RightDrawerWorkflowSelectAction } from '@/workflow/workflow-steps/workflow-actions/components/RightDrawerWorkflowSelectAction';
import { RightDrawerWorkflowSelectTriggerType } from '@/workflow/workflow-trigger/components/RightDrawerWorkflowSelectTriggerType';
import { isDefined } from 'twenty-shared';
import { rightDrawerPageState } from '../states/rightDrawerPageState';
import { RightDrawerPages } from '../types/RightDrawerPages';

const StyledRightDrawerBody = styled.div`
  display: flex;
  flex-direction: column;
  height: calc(
    100vh - ${({ theme }) => theme.spacing(14)} - 1px
  ); // (-1 for border)
  //overflow: auto;
  position: relative;
`;

const RIGHT_DRAWER_PAGES_CONFIG: ComponentByRightDrawerPage = {
  [RightDrawerPages.ViewEmailThread]: <RightDrawerEmailThread />,
  [RightDrawerPages.ViewCalendarEvent]: <RightDrawerCalendarEvent />,
  [RightDrawerPages.ViewRecord]: <RightDrawerRecord />,
  [RightDrawerPages.Copilot]: <RightDrawerAIChat />,
  [RightDrawerPages.WorkflowStepSelectTriggerType]: (
    <RightDrawerWorkflowSelectTriggerType />
  ),
  [RightDrawerPages.WorkflowStepSelectAction]: (
    <RightDrawerWorkflowSelectAction />
  ),
  [RightDrawerPages.WorkflowStepEdit]: <RightDrawerWorkflowEditStep />,
  [RightDrawerPages.WorkflowStepView]: <RightDrawerWorkflowViewStep />,
  [RightDrawerPages.SimpleActivity]: <SimpleActivityDrawer />,
  [RightDrawerPages.AllActions]: <RightDrawerAllActionsContent />,
  [RightDrawerPages.ChatAllActions]: <RightDrawerChatAllActionsContent />,
  [RightDrawerPages.CandidateChat]: <CandidateChatDrawer />,
};

export const RightDrawerRouter = () => {
  const [rightDrawerPage] = useRecoilState(rightDrawerPageState);
  
  console.log('RightDrawerRouter rendering with page:', rightDrawerPage);
  
  const rightDrawerPageComponent = isDefined(rightDrawerPage) ? (
    RIGHT_DRAWER_PAGES_CONFIG[rightDrawerPage]
  ) : (
    <></>
  );
  
  console.log('Selected component:', rightDrawerPageComponent ? 'Found' : 'Not Found');
  
  const isRightDrawerMinimized = useRecoilValue(isRightDrawerMinimizedState);
  return (
    <RightDrawerContainer>
      <RightDrawerTopBar />
      {!isRightDrawerMinimized && (
        <StyledRightDrawerBody>
          {rightDrawerPage === RightDrawerPages.CandidateChat && (
            <div style={{ padding: '16px', backgroundColor: '#f8f9fa', marginBottom: '8px', fontSize: '14px' }}>
              Debug: CandidateChat drawer requested
            </div>
          )}
          {rightDrawerPageComponent}
        </StyledRightDrawerBody>
      )}
    </RightDrawerContainer>
  );
};
