import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveOwnRouteBaseUrl } from 'src/logic-functions/data/resolve-own-route-base-url.util';

describe('resolveOwnRouteBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the injected functions url', () => {
    vi.stubEnv('TWENTY_FUNCTIONS_URL', 'https://acme.functions.example.com');

    expect(resolveOwnRouteBaseUrl()).toBe('https://acme.functions.example.com');
  });

  it('falls back to the API url /s route when the functions url is empty', () => {
    vi.stubEnv('TWENTY_FUNCTIONS_URL', '');
    vi.stubEnv('TWENTY_API_URL', 'https://app.example.com/');

    expect(resolveOwnRouteBaseUrl()).toBe('https://app.example.com/s');
  });

  it('fails clearly when neither the functions url nor the API url is injected', () => {
    vi.stubEnv('TWENTY_FUNCTIONS_URL', '');
    vi.stubEnv('TWENTY_API_URL', '');

    expect(() => resolveOwnRouteBaseUrl()).toThrow(
      'Unable to resolve Call Recorder own route target without TWENTY_FUNCTIONS_URL or TWENTY_API_URL',
    );
  });
});
