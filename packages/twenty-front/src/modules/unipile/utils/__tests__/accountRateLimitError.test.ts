import {
  collectAccountRateLimitErrorMessages,
  collectAccountRateLimitQueuedEvents,
  formatAccountRateLimitQueuedSnackBarMessage,
  formatAccountRateLimitSnackBarMessage,
  formatRetryWaitLabel,
  isAccountRateLimitErrorMessage,
  isLinkedinRateLimitPendingStep,
} from '@/unipile/utils/accountRateLimitError';

describe('accountRateLimitError', () => {
  it('detects rate limit exception text', () => {
    expect(
      isAccountRateLimitErrorMessage(
        'Rate limit reached for this search on account ABC. Retry in 81711s.',
      ),
    ).toBe(true);
    expect(isAccountRateLimitErrorMessage('LinkedIn search failed')).toBe(
      false,
    );
  });

  it('formats long retry waits in hours', () => {
    expect(formatRetryWaitLabel(81711)).toBe('23 hours');
    expect(
      formatAccountRateLimitSnackBarMessage(
        'Rate limit reached for this search on account ABC. Retry in 81711s.',
      ),
    ).toBe('Rate limit reached for this search. Retry in 23 hours.');
  });

  it('collects nested workflow step errors', () => {
    const messages = collectAccountRateLimitErrorMessages({
      stepInfos: {
        a: {
          status: 'FAILED',
          error:
            'Rate limit reached for this search on account ABC. Retry in 60s.',
        },
        b: {
          status: 'SUCCESS',
          result: {
            success: false,
            error:
              'Rate limit reached for this search on account ABC. Retry in 120s.',
          },
        },
      },
    });

    expect(messages).toHaveLength(2);
  });

  it('formats queued rate-limit waits', () => {
    expect(
      formatAccountRateLimitQueuedSnackBarMessage(81_711_000),
    ).toBe(
      'Search queued. Retrying in 23 hours (as per the rate limit intervals).',
    );
  });

  it('collects pending LinkedIn rate-limit queue metadata', () => {
    const events = collectAccountRateLimitQueuedEvents({
      stepInfos: {
        a: {
          status: 'PENDING',
          waitMs: 81_711_000,
          pendingReason: 'linkedin_rate_limit',
          result: {
            waitMs: 81_711_000,
            pendingReason: 'linkedin_rate_limit',
          },
        },
      },
    });

    expect(events).toEqual([{ waitMs: 81_711_000, scheduledAt: undefined }]);
    expect(
      isLinkedinRateLimitPendingStep({
        status: 'PENDING',
        pendingReason: 'linkedin_rate_limit',
        waitMs: 81_711_000,
      }),
    ).toBe(true);
  });
});
