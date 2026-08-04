export type WorkflowSendLinkedinInmailActionInput = {
  workspaceMemberId: string;
  linkedinProfileId: string;
  subject?: string;
  body?: string;
  // Resolved at runtime from the workspace member profile
  unipileAccountId?: string;
};
