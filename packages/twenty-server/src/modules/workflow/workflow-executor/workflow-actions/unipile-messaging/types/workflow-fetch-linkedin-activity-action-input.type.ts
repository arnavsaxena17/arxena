export type WorkflowFetchLinkedinActivityActionInput = {
  workspaceMemberId: string;
  linkedinProfileId: string;
  linkedinUrl?: string;
  candidateId?: string;
  postsLimit?: number;
  includeUserComments?: boolean;
  userCommentsLimit?: number;
  // Resolved at runtime from the workspace member profile
  unipileAccountId?: string;
};
