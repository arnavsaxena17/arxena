export type LinkedinUnipileMemberAccountStatus =
  | 'connected'
  | 'disconnected'
  | 'pending'
  | 'checkpoint_required'
  | 'not_connected';

export type LinkedinUnipileMemberAccountResolutionSource =
  | 'stored_profile'
  | 'usable_existing'
  | 'identity_match'
  | 'cookie_reconnect'
  | 'none';

export type ResolveMemberLinkedinUnipileAccountArgs = {
  workspaceId: string;
  workspaceMemberId: string;
  authToken: string;
  reconnectSourceToken?: string | null;
  premiumToken?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  country?: string | null;
  /** When true, never pass `reconnect_account` to Unipile (stale profile id was cleared). */
  omitReconnectAccountId?: boolean;
  cleanupContext?: string;
  reconnectLogContext?: string;
};

export type LinkedinUnipileMemberAccountResolution = {
  accountId: string | null;
  accountStatus: LinkedinUnipileMemberAccountStatus;
  isConnected: boolean;
  resolution: LinkedinUnipileMemberAccountResolutionSource;
  reconnectAttempted: boolean;
  reconnectSucceeded: boolean;
  reconnectMessage: string | null;
  accountCreatedThisSession: boolean;
  staleProfileAccountCleared: boolean;
};
