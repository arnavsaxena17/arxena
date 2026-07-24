import { HttpException, HttpStatus } from '@nestjs/common';

import { isUnipileInvalidLinkedinCookieCredentialsError } from '../is-unipile-invalid-linkedin-cookie-credentials-error.util';

describe('isUnipileInvalidLinkedinCookieCredentialsError', () => {
  it('detects structured invalid_credentials HttpException', () => {
    console.log('isUnipileInvalidLinkedinCookieCredentialsError: typed 401');
    expect(
      isUnipileInvalidLinkedinCookieCredentialsError(
        new HttpException(
          {
            type: 'errors/invalid_credentials',
            detail: 'The provided credentials are invalid.',
          },
          HttpStatus.UNAUTHORIZED,
        ),
      ),
    ).toBe(true);
  });

  it('detects string invalid credentials HttpException from makeUnipileRequest', () => {
    console.log('isUnipileInvalidLinkedinCookieCredentialsError: string 401');
    expect(
      isUnipileInvalidLinkedinCookieCredentialsError(
        new HttpException(
          'The provided credentials are invalid.',
          HttpStatus.UNAUTHORIZED,
        ),
      ),
    ).toBe(true);
  });

  it('does not treat disconnected_account as invalid cookie credentials', () => {
    console.log('isUnipileInvalidLinkedinCookieCredentialsError: disconnected');
    expect(
      isUnipileInvalidLinkedinCookieCredentialsError(
        new HttpException(
          { type: 'errors/disconnected_account' },
          HttpStatus.UNAUTHORIZED,
        ),
      ),
    ).toBe(false);
  });

  it('does not treat unrelated errors as invalid cookie credentials', () => {
    console.log('isUnipileInvalidLinkedinCookieCredentialsError: unrelated');
    expect(
      isUnipileInvalidLinkedinCookieCredentialsError(
        new HttpException('Forbidden', HttpStatus.FORBIDDEN),
      ),
    ).toBe(false);
    expect(
      isUnipileInvalidLinkedinCookieCredentialsError(new Error('network error')),
    ).toBe(false);
  });
});
