import { type WorkflowEmailFiles } from 'twenty-shared/workflow';

export type WorkflowSendLinkedinVoiceNoteActionInput = {
  workspaceMemberId: string;
  unipileAccountId?: string;
  linkedinProfileId: string;
  linkedinUrl?: string;
  candidateId?: string;
  body?: string;
  files?: WorkflowEmailFiles;
};
