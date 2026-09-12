export type WorkflowCommentOnLinkedinPostActionInput = {
  workspaceMemberId: string;
  postId: string;
  text: string;
  candidateId?: string;
  commentId?: string;
  // Resolved at runtime from the workspace member profile
  unipileAccountId?: string;
};
