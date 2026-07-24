import { HttpException, HttpStatus } from '@nestjs/common';

import { UnipileLinkedinAccountUnusableError } from '../../errors/unipile-linkedin-account-unusable.error';
import { isUnipileLinkedinAccountUnusableError } from '../is-unipile-linkedin-account-unusable-error.util';

describe('isUnipileLinkedinAccountUnusableError', () => {
  it('detects UnipileLinkedinAccountUnusableError instances', () => {
    console.log('isUnipileLinkedinAccountUnusableError: typed error');
    expect(
      isUnipileLinkedinAccountUnusableError(
        new UnipileLinkedinAccountUnusableError('pool account dead', {
          accountId: 'acc-1',
        }),
      ),
    ).toBe(true);
  });

  it('detects disconnected_account HttpException', () => {
    console.log('isUnipileLinkedinAccountUnusableError: disconnected 401');
    expect(
      isUnipileLinkedinAccountUnusableError(
        new HttpException(
          { type: 'errors/disconnected_account' },
          HttpStatus.UNAUTHORIZED,
        ),
      ),
    ).toBe(true);
  });

  it('detects account-not-found HttpException but not generic user 404', () => {
    console.log('isUnipileLinkedinAccountUnusableError: 404 heuristics');
    expect(
      isUnipileLinkedinAccountUnusableError(
        new HttpException('Account not found', HttpStatus.NOT_FOUND),
      ),
    ).toBe(true);
    expect(
      isUnipileLinkedinAccountUnusableError(
        new HttpException('User not found', HttpStatus.NOT_FOUND),
      ),
    ).toBe(false);
  });

  it('detects LinkedIn search failures caused by account issues', () => {
    console.log('isUnipileLinkedinAccountUnusableError: search error message');
    expect(
      isUnipileLinkedinAccountUnusableError(
        new Error(
          'LinkedIn search failed: Disconnected account - The LinkedIn account is disconnected',
        ),
      ),
    ).toBe(true);
    expect(
      isUnipileLinkedinAccountUnusableError(
        new Error('LinkedIn search failed: Invalid query - keywords required'),
      ),
    ).toBe(false);
  });

  it('does not treat unrelated business errors as account failures', () => {
    console.log('isUnipileLinkedinAccountUnusableError: unrelated error');
    expect(isUnipileLinkedinAccountUnusableError(new Error('LLM timeout'))).toBe(
      false,
    );
  });
});
