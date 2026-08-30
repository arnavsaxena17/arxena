import {
  type OutreachContext,
  buildOutreachContextPrompt,
} from '@/outreach-home/types/outreach-home.types';
import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const DEFAULT_OUTREACH_CONTEXT: OutreachContext = {
  projectId: null,
  projectName: null,
  outreachWorkflowId: null,
  outreachSendMode: 'APPROVAL',
  selectedCompanyId: null,
  selectedPersonId: null,
  selectedCandidateStage: null,
  icpName: null,
  icpSpecSummary: null,
  linkedinConnected: false,
  gmailConnected: false,
  whatsappConnected: false,
  phase: null,
};

export const isSameOutreachContext = (
  left: OutreachContext,
  right: OutreachContext,
): boolean =>
  left.projectId === right.projectId &&
  left.projectName === right.projectName &&
  left.outreachWorkflowId === right.outreachWorkflowId &&
  left.outreachSendMode === right.outreachSendMode &&
  left.selectedCompanyId === right.selectedCompanyId &&
  left.selectedPersonId === right.selectedPersonId &&
  left.selectedCandidateStage === right.selectedCandidateStage &&
  left.icpName === right.icpName &&
  left.icpSpecSummary === right.icpSpecSummary &&
  left.linkedinConnected === right.linkedinConnected &&
  left.gmailConnected === right.gmailConnected &&
  left.whatsappConnected === right.whatsappConnected &&
  left.phase === right.phase;

export const outreachContextState = createAtomState<OutreachContext>({
  key: 'outreachContextState',
  defaultValue: DEFAULT_OUTREACH_CONTEXT,
});

export { buildOutreachContextPrompt };
