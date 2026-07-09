import { CalendarMeetingLookupService } from 'src/engine/core-modules/calendar/calendar-meeting-lookup.service';

describe('CalendarMeetingLookupService', () => {
  const createService = ({
    participants = [],
    person = null,
  }: {
    participants?: Array<{ calendarEventId: string }>;
    person?: { id: string; emails: { primaryEmail: string } } | null;
  }) => {
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(participants),
    };

    const participantRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const personRepository = {
      findOne: jest.fn().mockResolvedValue(person),
    };

    const twentyORMManager = {
      getRepository: jest.fn().mockImplementation((objectName: string) => {
        if (objectName === 'calendarEventParticipant') {
          return Promise.resolve(participantRepository);
        }

        if (objectName === 'person') {
          return Promise.resolve(personRepository);
        }

        throw new Error(`Unexpected repository: ${objectName}`);
      }),
    };

    return {
      service: new CalendarMeetingLookupService(twentyORMManager as never),
      queryBuilder,
    };
  };

  it('returns true when synced calendar has an upcoming event for the email', async () => {
    const { service, queryBuilder } = createService({
      participants: [{ calendarEventId: 'event-1' }],
    });

    const result = await service.hasUpcomingMeetingForEmail('arnav@arxorg.com');

    console.log('calendar lookup by email result', result);

    expect(queryBuilder.getMany).toHaveBeenCalled();
    expect(result.hasUpcomingMeeting).toBe(true);
    expect(result.matchedEventIds).toEqual(['event-1']);
  });

  it('returns false when no upcoming calendar events match the email', async () => {
    const { service } = createService({ participants: [] });

    const result = await service.hasUpcomingMeetingForEmail('arnav@arxorg.com');

    console.log('calendar lookup empty result', result);

    expect(result.hasUpcomingMeeting).toBe(false);
    expect(result.matchedEventIds).toEqual([]);
  });

  it('checks by person email first when personId is provided', async () => {
    const { service } = createService({
      person: {
        id: 'person-1',
        emails: { primaryEmail: 'arnav@arxorg.com' },
      },
      participants: [{ calendarEventId: 'event-2' }],
    });

    const result = await service.hasUpcomingMeetingForPersonEmail(
      'arnav@arxorg.com',
      'person-1',
    );

    console.log('calendar lookup by person result', result);

    expect(result.hasUpcomingMeeting).toBe(true);
    expect(result.matchedEventIds).toEqual(['event-2']);
  });
});
