export type UnipileV2AccountListItem = {
  id?: string;
  metadata?: {
    v1_account_id?: string;
  };
};

export const isUnipileV2AccountId = (accountId: string): boolean =>
  /^acc_/i.test(accountId.trim());

export const findUnipileV2AccountId = (
  accounts: UnipileV2AccountListItem[],
  v1OrV2AccountId: string,
): string | null => {
  const target = v1OrV2AccountId.trim();
  if (!target) {
    return null;
  }

  const byId = accounts.find((account) => account.id?.trim() === target);
  if (byId?.id?.trim()) {
    return byId.id.trim();
  }

  const byV1 = accounts.find(
    (account) => account.metadata?.v1_account_id?.trim() === target,
  );

  return byV1?.id?.trim() || null;
};
