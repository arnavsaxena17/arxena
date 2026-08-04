export type WorkflowSendWhatsappMessageActionInput = {
  workspaceMemberId: string;
  phone: string;
  body?: string;
  // Resolved at runtime from the workspace member profile
  unipileAccountId?: string;
};
