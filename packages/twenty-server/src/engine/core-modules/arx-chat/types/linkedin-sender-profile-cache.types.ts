import type { WorkspaceMemberLinkedinProfileStorage } from 'twenty-shared';

export type LinkedinSenderFullProfileCacheEntry = WorkspaceMemberLinkedinProfileStorage & {
  me: NonNullable<WorkspaceMemberLinkedinProfileStorage['me']>;
  fullProfile: NonNullable<WorkspaceMemberLinkedinProfileStorage['fullProfile']>;
  publicIdentifier: string;
};

export type LinkedinSenderFullProfileResult = {
  entry: LinkedinSenderFullProfileCacheEntry;
  fromCache: boolean;
};
