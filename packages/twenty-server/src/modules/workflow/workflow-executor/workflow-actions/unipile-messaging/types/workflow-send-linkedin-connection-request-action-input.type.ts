export type WorkflowSendLinkedinConnectionRequestActionInput = {
  workspaceMemberId: string;
  linkedinProfileId: string;
  linkedinUrl?: string;
  candidateId?: string;
  message?: string;
  // Resolved at runtime from the workspace member profile
  unipileAccountId?: string;
};
