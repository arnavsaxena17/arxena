import { formatExceptionPath } from 'src/engine/core-modules/exception-handler/utils/format-exception-path.util';

describe('formatExceptionPath', () => {
  it('joins GraphQL path arrays and masks numeric indexes', () => {
    expect(formatExceptionPath(['user', 0, 'email'])).toBe(
      'user > $index > email',
    );
  });

  it('returns filesystem-style string paths without calling map', () => {
    expect(formatExceptionPath('/tmp/missing-file.json')).toBe(
      '/tmp/missing-file.json',
    );
  });

  it('returns an empty string for missing or unsupported path values', () => {
    expect(formatExceptionPath(undefined)).toBe('');
    expect(formatExceptionPath(null)).toBe('');
    expect(formatExceptionPath({ key: 'user' })).toBe('');
  });
});
