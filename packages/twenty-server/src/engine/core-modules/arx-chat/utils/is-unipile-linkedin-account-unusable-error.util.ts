import { HttpException, HttpStatus } from '@nestjs/common';

import { UnipileLinkedinAccountUnusableError } from '../errors/unipile-linkedin-account-unusable.error';
import {
  isUnipileAccountNotFoundApiError,
  isUnipileDisconnectedAccountApiError,
} from './unipile-disconnected-account.util';

const isLinkedinSearchAccountFailureMessage = (message: string): boolean => {
  const normalized = message.toLowerCase();
  if (!normalized.includes('linkedin search failed')) {
    return false;
  }

  return (
    normalized.includes('disconnected') ||
    normalized.includes('disconnected_account') ||
    normalized.includes('invalid account') ||
    normalized.includes('account not found') ||
    normalized.includes('unknown account')
  );
};

export const isUnipileLinkedinAccountUnusableError = (error: unknown): boolean => {
  if (error instanceof UnipileLinkedinAccountUnusableError) {
    return true;
  }

  if (error instanceof HttpException) {
    const status = error.getStatus();
    const response = error.getResponse();

    if (status === HttpStatus.UNAUTHORIZED) {
      return isUnipileDisconnectedAccountApiError(
        status,
        typeof response === 'object' && response !== null ? response : {},
      );
    }

    if (isUnipileAccountNotFoundApiError(status, response)) {
      return true;
    }
  }

  if (error instanceof Error) {
    return isLinkedinSearchAccountFailureMessage(error.message);
  }

  return false;
};
