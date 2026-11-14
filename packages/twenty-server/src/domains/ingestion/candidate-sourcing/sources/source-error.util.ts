import { HttpException, HttpStatus } from '@nestjs/common';

import { AccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { type SourceErrorCode } from 'src/domains/ingestion/candidate-sourcing/sources/adapter';

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Thrown strings, deferred-account errors and HTTP statuses become the one
// code that retry, stop and the message read. An adapter calls this in its
// catch; nothing downstream inspects a provider's own error.
export const toSourceErrorCode = (error: unknown): SourceErrorCode => {
  if (error instanceof AccountRateLimitDeferredError) {
    return 'deferred';
  }

  const status = error instanceof HttpException ? error.getStatus() : undefined;
  const message = messageOf(error).toLowerCase();

  if (
    status === HttpStatus.TOO_MANY_REQUESTS ||
    /rate.?limit|too many requests/.test(message)
  ) {
    return 'rate_limited';
  }

  if (
    status === HttpStatus.SERVICE_UNAVAILABLE ||
    status === HttpStatus.NOT_IMPLEMENTED ||
    /not configured|api key (is )?(missing|required)/.test(message)
  ) {
    return 'unconfigured';
  }

  if (/no_results|no results/.test(message)) {
    return 'no_results';
  }

  return 'upstream';
};
