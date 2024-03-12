import { addHours, subHours } from 'date-fns';

import { hasCalendarEventStarted } from '../hasCalendarEventStarted';

describe('hasCalendarEventStarted', () => {
  it('returns true for an event with a past start date', () => {
    // Given
    const startsAt = subHours(new Date(), 2);

    // When
    const result = hasCalendarEventStarted({ startsAt });

    // Then
    expect(result).toBe(true);
  });

  it('returns false for an event if start date is now', () => {
    // Given
    const startsAt = new Date();

    // When
    const result = hasCalendarEventStarted({ startsAt });

    // Then
    expect(result).toBe(false);
  });

  it('returns false for an event with a future start date', () => {
    // Given
    const startsAt = addHours(new Date(), 1);

    // When
    const result = hasCalendarEventStarted({ startsAt });

    // Then
    expect(result).toBe(false);
  });
});
