import axios from 'axios';

import { formatContactEnrichmentError } from '../format-contact-enrichment-error.util';

describe('formatContactEnrichmentError', () => {
  it('should summarize axios errors without config or headers', () => {
    const error = new axios.AxiosError(
      'Request failed with status code 401',
      'ERR_BAD_REQUEST',
      {
        headers: { 'x-api-key': 'secret-should-not-appear' },
      } as never,
      {},
      {
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config: {} as never,
        data: { error: 'Invalid access credentials.' },
      },
    );

    const summary = formatContactEnrichmentError(error);

    expect(summary).toBe('HTTP 401: Invalid access credentials.');
    expect(summary).not.toContain('secret-should-not-appear');
  });

  it('should read nested PDL payment_required message', () => {
    const error = new axios.AxiosError(
      'Request failed with status code 402',
      'ERR_BAD_REQUEST',
      {} as never,
      {},
      {
        status: 402,
        statusText: 'Payment Required',
        headers: {},
        config: {} as never,
        data: {
          status: 402,
          error: {
            type: ['payment_required'],
            message:
              'You have hit your account maximum for person enrichment (all matches used)',
          },
        },
      },
    );

    expect(formatContactEnrichmentError(error)).toBe(
      'HTTP 402: You have hit your account maximum for person enrichment (all matches used)',
    );
  });

  it('should fall back to Error.message', () => {
    expect(formatContactEnrichmentError(new Error('boom'))).toBe('boom');
  });
});
