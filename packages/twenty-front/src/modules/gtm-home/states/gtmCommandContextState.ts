import {
  type GtmCommandContext,
  buildGtmCommandContextPrompt,
} from '@/gtm-home/types/gtm-home.types';
import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const DEFAULT_GTM_COMMAND_CONTEXT: GtmCommandContext = {
  projectId: null,
  projectName: null,
  gtmRunKey: null,
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

export const gtmCommandContextState = createAtomState<GtmCommandContext>({
  key: 'gtmCommandContextState',
  defaultValue: DEFAULT_GTM_COMMAND_CONTEXT,
});

export { buildGtmCommandContextPrompt };
