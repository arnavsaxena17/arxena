import { CommandMenuPages } from '@/command-menu/types/CommandMenuPages';
import { RightDrawerPages } from '@/ui/layout/right-drawer/types/RightDrawerPages';

export const mapRightDrawerPageToCommandMenuPage = (
  rightDrawerPage: RightDrawerPages,
) => {
  switch (rightDrawerPage) {
    case RightDrawerPages.ViewRecord:
      return CommandMenuPages.ViewRecord;
    case RightDrawerPages.ViewEmailThread:
      return CommandMenuPages.ViewEmailThread;
    case RightDrawerPages.ViewCalendarEvent:
      return CommandMenuPages.ViewCalendarEvent;
    case RightDrawerPages.Copilot:
      return CommandMenuPages.Copilot;
    case RightDrawerPages.WorkflowStepSelectTriggerType:
      return CommandMenuPages.WorkflowStepSelectTriggerType;
    case RightDrawerPages.WorkflowStepSelectAction:
      return CommandMenuPages.WorkflowStepSelectAction;
    case RightDrawerPages.WorkflowStepView:
      return CommandMenuPages.WorkflowStepView;
    case RightDrawerPages.WorkflowStepEdit:
      return CommandMenuPages.WorkflowStepEdit;
    case RightDrawerPages.CandidateChat:
      return CommandMenuPages.CandidateChat;
    case RightDrawerPages.CandidateActions:
      return CommandMenuPages.CandidateActions;
    case RightDrawerPages.ClientChat:
      return CommandMenuPages.ClientChat;
    case RightDrawerPages.SimpleActivity:
      return CommandMenuPages.SimpleActivity;
    case RightDrawerPages.AllActions:
      return CommandMenuPages.AllActions;
    case RightDrawerPages.Notifications:
      return CommandMenuPages.Notifications;
    default:
      return CommandMenuPages.Root;
  }
};
