import { HttpException, HttpStatus } from '@nestjs/common';

import { isUnipileAttendeeNotFoundError } from '../is-unipile-attendee-not-found-error.util';

describe('isUnipileAttendeeNotFoundError', () => {
  it('detects Unipile attendee 404 body text', () => {
    expect(
      isUnipileAttendeeNotFoundError(
        new Error('The requested resource were not found.\nAttendee not found'),
      ),
    ).toBe(true);
  });

  it('detects HttpException NOT_FOUND with attendee message', () => {
    expect(
      isUnipileAttendeeNotFoundError(
        new HttpException('Attendee not found', HttpStatus.NOT_FOUND),
      ),
    ).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isUnipileAttendeeNotFoundError(new Error('rate limit'))).toBe(false);
    expect(
      isUnipileAttendeeNotFoundError(
        new HttpException('User not found', HttpStatus.NOT_FOUND),
      ),
    ).toBe(false);
  });
});
