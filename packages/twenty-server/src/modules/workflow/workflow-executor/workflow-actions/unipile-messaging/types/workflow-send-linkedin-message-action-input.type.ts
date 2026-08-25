import { type EmailAttachment } from 'twenty-shared/types';

export type WorkflowSendLinkedinMessageActionInput = {
  workspaceMemberId: string;
  linkedinProfileId: string;
  linkedinUrl?: string;
  candidateId?: string;
  body?: string;
  files?: EmailAttachment[];
  // Resolved at runtime from the workspace member profile
  unipileAccountId?: string;
};
