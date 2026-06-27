const responseToMessage = (response: unknown): string => {
  if (typeof response === 'string') {
    return response;
  }

  if (response && typeof response === 'object') {
    const record = response as {
      detail?: string;
      message?: string;
      title?: string;
    };
    return [record.title, record.detail, record.message].filter(Boolean).join(' ');
  }

  return '';
};

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

export const isUnipileAccountNotFoundApiError = (
  status: number,
  data: unknown,
): boolean => {
  if (status !== 404) {
    return false;
  }

  const message = responseToMessage(data).toLowerCase();
  return (
    message.includes('account') &&
    (message.includes('not found') ||
      message.includes('does not exist') ||
      message.includes('unknown account'))
  );
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
