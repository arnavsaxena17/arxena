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

export const outreachContextState = createAtomState<OutreachContext>({
  key: 'outreachContextState',
  defaultValue: DEFAULT_OUTREACH_CONTEXT,
});

export { buildOutreachContextPrompt };
