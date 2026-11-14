import axios from 'axios';

// One-line summary only — never log Axios config (leaks API keys).
export const formatContactEnrichmentError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;
    let detail = error.message;

    if (typeof data === 'string' && data.length > 0) {
      detail = data.slice(0, 200);
    } else if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;

      if (typeof record.error === 'string') {
        detail = record.error;
      } else if (
        record.error &&
        typeof record.error === 'object' &&
        typeof (record.error as { message?: unknown }).message === 'string'
      ) {
        detail = (record.error as { message: string }).message;
      } else if (typeof record.message === 'string') {
        detail = record.message;
      }
    }

    return status !== undefined ? `HTTP ${status}: ${detail}` : detail;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};
