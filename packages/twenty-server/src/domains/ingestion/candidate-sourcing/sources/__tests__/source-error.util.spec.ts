import { HttpException, HttpStatus } from '@nestjs/common';

import { AccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { toSourceErrorCode } from 'src/domains/ingestion/candidate-sourcing/sources/source-error.util';

describe('toSourceErrorCode', () => {
  it('should read a deferred account as deferred, not as a rate limit', () => {
    const error = new AccountRateLimitDeferredError({
      waitMs: 1000,
      accountId: 'account',
      method: 'search',
      message: 'rate limit reached, deferred',
    });

    expect(toSourceErrorCode(error)).toBe('deferred');
  });

  it('should read a 429 or a rate-limit message as rate_limited', () => {
    expect(
      toSourceErrorCode(
        new HttpException('slow down', HttpStatus.TOO_MANY_REQUESTS),
      ),
    ).toBe('rate_limited');
    expect(toSourceErrorCode(new Error('Rate limit exceeded'))).toBe(
      'rate_limited',
    );
  });

  it('should read a 503 or a missing key as unconfigured', () => {
    expect(
      toSourceErrorCode(
        new HttpException('off', HttpStatus.SERVICE_UNAVAILABLE),
      ),
    ).toBe('unconfigured');
    expect(toSourceErrorCode(new Error('HARVEST is not configured'))).toBe(
      'unconfigured',
    );
  });

  it('should read NO_RESULTS as no_results', () => {
    expect(toSourceErrorCode('NO_RESULTS')).toBe('no_results');
  });

  it('should treat anything else as upstream', () => {
    expect(
      toSourceErrorCode(
        new HttpException('bad gateway', HttpStatus.BAD_GATEWAY),
      ),
    ).toBe('upstream');
    expect(toSourceErrorCode(undefined)).toBe('upstream');
  });
});
