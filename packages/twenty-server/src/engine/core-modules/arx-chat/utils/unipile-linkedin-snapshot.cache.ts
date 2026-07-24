import type { UnipileAccountOwnerProfile } from 'twenty-shared';

export type UnipileLinkedinSnapshotAccountRow = {
  id?: string;
  username: string;
  name: string;
  type?: string;
  status: 'connected' | 'disconnected' | 'pending' | 'checkpoint_required';
  created_at?: string;
  provider: 'LINKEDIN';
  connection_params?: Record<string, unknown>;
  sources?: { status?: string }[];
  groups?: unknown[];
};

export type UnipileLinkedinSnapshotRawAccount = Record<string, unknown> & {
  id?: string;
  type?: string;
};

export type UnipileLinkedinSnapshot = {
  rawAccountsList: { items?: UnipileLinkedinSnapshotRawAccount[] };
  linkedinAccounts: UnipileLinkedinSnapshotAccountRow[];
  ownerProfilesByAccountId: Map<string, UnipileAccountOwnerProfile | null>;
  refreshedAt: number;
  expiresAt: number;
};

export const UNIPILE_LINKEDIN_SNAPSHOT_TTL_MS = 60 * 60 * 1000;

let cachedSnapshot: UnipileLinkedinSnapshot | null = null;

export const isUnipileLinkedinSnapshotFresh = (): boolean =>
  cachedSnapshot !== null && cachedSnapshot.expiresAt > Date.now();

export const getUnipileLinkedinSnapshot = (): UnipileLinkedinSnapshot | null => {
  if (!isUnipileLinkedinSnapshotFresh()) {
    return null;
  }

  return cachedSnapshot;
};

export const setUnipileLinkedinSnapshot = (
  snapshot: Omit<UnipileLinkedinSnapshot, 'refreshedAt' | 'expiresAt'> & {
    refreshedAt?: number;
    expiresAt?: number;
  },
): void => {
  const refreshedAt = snapshot.refreshedAt ?? Date.now();
  cachedSnapshot = {
    ...snapshot,
    refreshedAt,
    expiresAt:
      snapshot.expiresAt ?? refreshedAt + UNIPILE_LINKEDIN_SNAPSHOT_TTL_MS,
  };
};

export const invalidateUnipileLinkedinSnapshotCache = (): void => {
  cachedSnapshot = null;
};

export const getSnapshotRawAccountsList = (): {
  items?: UnipileLinkedinSnapshotRawAccount[];
} | null => getUnipileLinkedinSnapshot()?.rawAccountsList ?? null;

export const getSnapshotLinkedinAccounts =
  (): UnipileLinkedinSnapshotAccountRow[] | null =>
    getUnipileLinkedinSnapshot()?.linkedinAccounts ?? null;

export const hasSnapshotOwnerProfile = (accountId: string): boolean => {
  const snapshot = getUnipileLinkedinSnapshot();
  if (!snapshot) {
    return false;
  }

  return snapshot.ownerProfilesByAccountId.has(accountId.trim());
};

export const getSnapshotOwnerProfile = (
  accountId: string,
): UnipileAccountOwnerProfile | null | undefined => {
  const snapshot = getUnipileLinkedinSnapshot();
  if (!snapshot) {
    return undefined;
  }

  const trimmed = accountId.trim();
  if (!snapshot.ownerProfilesByAccountId.has(trimmed)) {
    return undefined;
  }

  return snapshot.ownerProfilesByAccountId.get(trimmed) ?? null;
};

export const getSnapshotRawAccountById = (
  accountId: string,
): UnipileLinkedinSnapshotRawAccount | null | undefined => {
  const snapshot = getUnipileLinkedinSnapshot();
  if (!snapshot) {
    return undefined;
  }

  const trimmed = accountId.trim();
  const match = (snapshot.rawAccountsList.items ?? []).find(
    (item) => item.id?.trim() === trimmed,
  );

  if (!match) {
    return null;
  }

  return match;
};

export const patchSnapshotOwnerProfile = (
  accountId: string,
  profile: UnipileAccountOwnerProfile | null,
): void => {
  const snapshot = getUnipileLinkedinSnapshot();
  if (!snapshot) {
    return;
  }

  snapshot.ownerProfilesByAccountId.set(accountId.trim(), profile);
};

export const patchSnapshotRawAccount = (
  account: UnipileLinkedinSnapshotRawAccount,
): void => {
  const snapshot = getUnipileLinkedinSnapshot();
  const accountId = account.id?.trim();
  if (!snapshot || !accountId) {
    return;
  }

  const items = snapshot.rawAccountsList.items ?? [];
  const existingIndex = items.findIndex((item) => item.id?.trim() === accountId);
  if (existingIndex >= 0) {
    items[existingIndex] = account;
  } else {
    items.push(account);
  }

  snapshot.rawAccountsList.items = items;
};

export const removeSnapshotAccountById = (accountId: string): boolean => {
  const snapshot = getUnipileLinkedinSnapshot();
  const trimmed = accountId.trim();
  if (!snapshot || !trimmed) {
    return false;
  }

  let removed = false;

  if (snapshot.ownerProfilesByAccountId.delete(trimmed)) {
    removed = true;
  }

  const rawItems = snapshot.rawAccountsList.items ?? [];
  const filteredRawItems = rawItems.filter((item) => item.id?.trim() !== trimmed);
  if (filteredRawItems.length !== rawItems.length) {
    snapshot.rawAccountsList.items = filteredRawItems;
    removed = true;
  }

  const filteredLinkedinAccounts = snapshot.linkedinAccounts.filter(
    (item) => item.id?.trim() !== trimmed,
  );
  if (filteredLinkedinAccounts.length !== snapshot.linkedinAccounts.length) {
    snapshot.linkedinAccounts = filteredLinkedinAccounts;
    removed = true;
  }

  return removed;
};
