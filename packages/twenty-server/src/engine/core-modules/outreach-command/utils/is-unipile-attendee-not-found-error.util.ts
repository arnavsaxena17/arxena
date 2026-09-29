import { HttpException, HttpStatus } from '@nestjs/common';

const isAttendeeNotFoundMessage = (message: string): boolean => {
  const normalized = message.toLowerCase();

  return (
    normalized.includes('attendee not found') ||
    (normalized.includes('attendee') && normalized.includes('not found'))
  );
};

// Chat may not exist yet right after a connection accept; treat as empty inbox.
export const isUnipileAttendeeNotFoundError = (error: unknown): boolean => {
  if (error instanceof HttpException) {
    if (error.getStatus() === HttpStatus.NOT_FOUND) {
      return isAttendeeNotFoundMessage(error.message);
    }
  }

  if (error instanceof Error) {
    return isAttendeeNotFoundMessage(error.message);
  }

  return isAttendeeNotFoundMessage(String(error));
};
