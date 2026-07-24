export enum LinkedinUnipileEstimateAccountMode {
  SharedSalesNavigatorPool = 'shared_sales_navigator_pool',
  Session = 'session',
  EnvAccountId = 'env_account_id',
}

export const parseLinkedinUnipileEstimateAccountMode = (
  raw: string | undefined,
): LinkedinUnipileEstimateAccountMode => {
  const normalized = raw?.trim().toLowerCase();

  if (
    normalized === '1' ||
    normalized === LinkedinUnipileEstimateAccountMode.SharedSalesNavigatorPool
  ) {
    return LinkedinUnipileEstimateAccountMode.SharedSalesNavigatorPool;
  }

  if (
    normalized === '3' ||
    normalized === LinkedinUnipileEstimateAccountMode.EnvAccountId
  ) {
    return LinkedinUnipileEstimateAccountMode.EnvAccountId;
  }

  return LinkedinUnipileEstimateAccountMode.Session;
};
