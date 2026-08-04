export type WorkflowSendLinkedinMessageActionInput = {
  workspaceMemberId: string;
  linkedinProfileId: string;
  body?: string;
  // Resolved at runtime from the workspace member profile
  unipileAccountId?: string;
};
