export type LinkedinUnipileAccountCleanupContext = {
  accountId: string;
  workspaceMemberId: string;
  authToken: string;
  workspaceId?: string;
  context: string;
  /** Shared Sales Navigator pool accounts must not clear the member LinkedIn profile on disconnect. */
  isSharedPoolAccount?: boolean;
};
