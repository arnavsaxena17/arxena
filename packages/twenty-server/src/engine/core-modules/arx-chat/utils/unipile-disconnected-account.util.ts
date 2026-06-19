export const isUnipileDisconnectedAccountApiError = (
  status: number,
  data: unknown,
): boolean => {
  if (status !== 401) {
    return false;
  }

  const type = (data as { type?: string } | null)?.type;
  return type === 'errors/disconnected_account';
};

export const parseAccountIdFromUnipileEndpoint = (
  endpoint: string,
): string | null => {
  const queryMatch = endpoint.match(/[?&]account_id=([^&]+)/);
  if (queryMatch?.[1]) {
    return decodeURIComponent(queryMatch[1]).trim();
  }

  return null;
};
