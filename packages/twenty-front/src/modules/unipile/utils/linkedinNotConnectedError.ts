export const LINKEDIN_NOT_CONNECTED_SNACKBAR_KEY =
  'linkedin-unipile-not-connected';

export const LINKEDIN_NOT_CONNECTED_USER_MESSAGE = 'LinkedIn is not connected.';

export const isLinkedInNotConnectedErrorMessage = (message: string) => {
  const normalized = message.toLowerCase();

  return (
    normalized.includes('linkedin is not connected') ||
    normalized.includes('linkedin account id') ||
    normalized.includes('failed to get linkedin account id') ||
    normalized.includes('no linkedin unipile') ||
    (normalized.includes('linkedin unipile') &&
      (normalized.includes('not found') ||
        normalized.includes('not connected') ||
        normalized.includes('unavailable')))
  );
};

export const extractHttpErrorMessage = (
  payload: unknown,
  fallback: string,
): string => {
  if (typeof payload === 'string' && payload.trim().length > 0) {
    return payload;
  }

  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;

    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }

    if (Array.isArray(message) && typeof message[0] === 'string') {
      return message[0];
    }
  }

  return fallback;
};

export const readHttpErrorMessageFromResponse = async (response: Response) => {
  try {
    const payload: unknown = await response.json();

    return extractHttpErrorMessage(
      payload,
      `Request failed (${response.status})`,
    );
  } catch {
    return `Request failed (${response.status})`;
  }
};
