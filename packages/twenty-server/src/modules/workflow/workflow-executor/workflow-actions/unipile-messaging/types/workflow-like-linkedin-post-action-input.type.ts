export type WorkflowLikeLinkedinPostActionInput = {
  workspaceMemberId: string;
  unipileAccountId?: string;
  postId: string;
  reactionType?:
    | 'like'
    | 'celebrate'
    | 'support'
    | 'love'
    | 'insightful'
    | 'funny';
  candidateId?: string;
  commentId?: string;
};
