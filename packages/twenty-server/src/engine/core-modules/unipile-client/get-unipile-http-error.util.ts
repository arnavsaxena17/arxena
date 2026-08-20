import { HttpException } from '@nestjs/common';

export type UnipileHttpErrorPayload = {
  status?: number;
  type?: string;
  detail?: string;
  message?: string;
};

export const getUnipileHttpErrorPayload = (
  error: unknown,
): UnipileHttpErrorPayload => {
  if (error instanceof HttpException) {
    const status = error.getStatus();
    const response = error.getResponse();
    if (typeof response === 'string') {
      return { status, message: response, detail: response };
    }
    const record =
      response && typeof response === 'object'
        ? (response as Record<string, unknown>)
        : {};
    const nested =
      record.data && typeof record.data === 'object'
        ? (record.data as Record<string, unknown>)
        : record;
    const type = typeof nested.type === 'string' ? nested.type : undefined;
    const detail =
      typeof nested.detail === 'string'
        ? nested.detail
        : typeof nested.message === 'string'
          ? nested.message
          : undefined;

    return {
      status,
      type,
      detail,
      message:
        typeof nested.message === 'string' ? nested.message : error.message,
    };
  }

  const anyErr = error as {
    response?: { status?: number; data?: Record<string, unknown> };
    message?: string;
  };

  return {
    status: anyErr.response?.status,
    type:
      typeof anyErr.response?.data?.type === 'string'
        ? anyErr.response.data.type
        : undefined,
    detail:
      typeof anyErr.response?.data?.detail === 'string'
        ? anyErr.response.data.detail
        : undefined,
    message: anyErr.message,
  };
};

export const isUnipileInviteFallbackError = (error: unknown): boolean => {
  const payload = getUnipileHttpErrorPayload(error);

  return (
    (payload.status === 403 &&
      payload.type === 'errors/subscription_required') ||
    (payload.status === 422 &&
      payload.type === 'errors/no_connection_with_recipient')
  );
};
