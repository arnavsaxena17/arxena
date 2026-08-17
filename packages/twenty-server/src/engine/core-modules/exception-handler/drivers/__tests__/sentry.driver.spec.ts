import * as Sentry from '@sentry/node';

import { ExceptionHandlerSentryDriver } from 'src/engine/core-modules/exception-handler/drivers/sentry.driver';

jest.mock('@sentry/node', () => ({
  withScope: jest.fn(),
  captureException: jest.fn(() => 'event-id'),
}));

describe('ExceptionHandlerSentryDriver', () => {
  const addBreadcrumb = jest.fn();
  const setExtra = jest.fn();
  const setUser = jest.fn();
  const setContext = jest.fn();
  const setTag = jest.fn();
  const setFingerprint = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (Sentry.withScope as jest.Mock).mockImplementation((callback) =>
      callback({
        addBreadcrumb,
        setExtra,
        setUser,
        setContext,
        setTag,
        setFingerprint,
      }),
    );
  });

  it('does not throw when exception.path is a filesystem string', () => {
    const driver = new ExceptionHandlerSentryDriver();
    const exception = Object.assign(new Error('ENOENT'), {
      path: '/tmp/missing-file.json',
    });

    expect(() => driver.captureExceptions([exception])).not.toThrow();
    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'execution-path',
      message: '/tmp/missing-file.json',
      level: 'debug',
    });
    expect(Sentry.captureException).toHaveBeenCalledWith(
      exception,
      expect.any(Object),
    );
  });

  it('returns captured event ids when the driver cannot build extras', () => {
    (Sentry.withScope as jest.Mock).mockImplementation(() => {
      throw new TypeError('(exception.path ?? []).map is not a function');
    });

    const driver = new ExceptionHandlerSentryDriver();

    expect(driver.captureExceptions([new Error('boom')])).toEqual([]);
  });
});
