import { RightDrawerAllActionsContent } from '@/action-menu/components/RightDrawerAllActionsContent';
import { RightDrawerCalendarEvent } from '@/activities/calendar/right-drawer/components/RightDrawerCalendarEvent';
import { RightDrawerAIChat } from '@/activities/copilot/right-drawer/components/RightDrawerAIChat';
import { RightDrawerEmailThread } from '@/activities/emails/right-drawer/components/RightDrawerEmailThread';
import { CandidateChatDrawer } from '@/candidate-table/CandidateChatDrawer';
import { ClientChatDrawer } from '@/candidate-table/ClientChatDrawer';
import { WhatsappTemplatesProvider } from '@/candidate-table/components/WhatsappTemplatesProvider';
import { RightDrawerCandidateActionsContent } from '@/candidate-table/RightDrawerCandidateActionsContent';
import { SimpleActivityDrawer } from '@/candidate-table/SimpleActivityDrawer';
import { CommandMenu } from '@/command-menu/components/CommandMenu';
import { CommandMenuSearchRecordsPage } from '@/command-menu/pages/components/CommandMenuSearchRecordsPage';
import { CommandMenuPages } from '@/command-menu/types/CommandMenuPages';
import { RightDrawerRecord } from '@/object-record/record-right-drawer/components/RightDrawerRecord';
import { NotificationsDrawer } from '@/ui/notifications/components/NotificationsDrawer';
import { RightDrawerWorkflowEditStep } from '@/workflow/workflow-steps/components/RightDrawerWorkflowEditStep';
import { RightDrawerWorkflowViewStep } from '@/workflow/workflow-steps/components/RightDrawerWorkflowViewStep';
import { RightDrawerWorkflowSelectAction } from '@/workflow/workflow-steps/workflow-actions/components/RightDrawerWorkflowSelectAction';
import { RightDrawerWorkflowSelectTriggerType } from '@/workflow/workflow-trigger/components/RightDrawerWorkflowSelectTriggerType';

export const COMMAND_MENU_PAGES_CONFIG = new Map<
  CommandMenuPages,
  React.ReactNode
>([
  [CommandMenuPages.Root, <CommandMenu />],
  [CommandMenuPages.ViewRecord, <RightDrawerRecord />],
  [CommandMenuPages.ViewEmailThread, <RightDrawerEmailThread />],
  [CommandMenuPages.ViewCalendarEvent, <RightDrawerCalendarEvent />],
  [CommandMenuPages.Copilot, <RightDrawerAIChat />],
  [
    CommandMenuPages.WorkflowStepSelectTriggerType,
    <RightDrawerWorkflowSelectTriggerType />,
  ],
  [
    CommandMenuPages.WorkflowStepSelectAction,
    <RightDrawerWorkflowSelectAction />,
  ],
  [CommandMenuPages.WorkflowStepEdit, <RightDrawerWorkflowEditStep />],
  [CommandMenuPages.WorkflowStepView, <RightDrawerWorkflowViewStep />],
  [CommandMenuPages.SearchRecords, <CommandMenuSearchRecordsPage />],
  [
    CommandMenuPages.CandidateChat,
    <WhatsappTemplatesProvider>
      <CandidateChatDrawer />
    </WhatsappTemplatesProvider>,
  ],
  [CommandMenuPages.CandidateActions, <RightDrawerCandidateActionsContent />],
  [CommandMenuPages.ClientChat, <ClientChatDrawer />],
  [CommandMenuPages.SimpleActivity, <SimpleActivityDrawer />],
  [CommandMenuPages.AllActions, <RightDrawerAllActionsContent />],
  [CommandMenuPages.Notifications, <NotificationsDrawer />],
]);
