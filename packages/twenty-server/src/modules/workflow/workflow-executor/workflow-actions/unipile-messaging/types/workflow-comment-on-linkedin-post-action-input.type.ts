export type WorkflowCommentOnLinkedinPostActionInput = {
  workspaceMemberId: string;
  postId: string;
  text: string;
  // Used for Unipile pacing / recipient identity (not sent to Unipile comment API).
  linkedinProfileId?: string;
  linkedinUrl?: string;
  candidateId?: string;
  commentId?: string;
  // Resolved at runtime from the workspace member profile
  unipileAccountId?: string;
};
