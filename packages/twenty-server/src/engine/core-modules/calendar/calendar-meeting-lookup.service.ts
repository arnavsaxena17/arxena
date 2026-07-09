import { Injectable, Logger } from '@nestjs/common';

import { TwentyORMManager } from 'src/engine/twenty-orm/twenty-orm.manager';
import { CalendarEventParticipantWorkspaceEntity } from 'src/modules/calendar/common/standard-objects/calendar-event-participant.workspace-entity';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

export type UpcomingMeetingLookupResult = {
  hasUpcomingMeeting: boolean;
  matchedEventIds: string[];
};

@Injectable()
export class CalendarMeetingLookupService {
  private readonly logger = new Logger(CalendarMeetingLookupService.name);

  constructor(private readonly twentyORMManager: TwentyORMManager) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async hasUpcomingMeetingForEmail(
    email: string,
  ): Promise<UpcomingMeetingLookupResult> {
    const normalizedEmail = this.normalizeEmail(email);

    if (!normalizedEmail) {
      return { hasUpcomingMeeting: false, matchedEventIds: [] };
    }

    const participantRepository =
      await this.twentyORMManager.getRepository<CalendarEventParticipantWorkspaceEntity>(
        'calendarEventParticipant',
      );

    const participants = await participantRepository
      .createQueryBuilder('participant')
      .innerJoin('participant.calendarEvent', 'event')
      .where('LOWER(participant.handle) = :email', { email: normalizedEmail })
      .andWhere('event.isCanceled = false')
      .andWhere('event.startsAt >= :now', { now: new Date().toISOString() })
      .select(['participant.id', 'participant.calendarEventId'])
      .getMany();

    const matchedEventIds = [
      ...new Set(
        participants
          .map((participant) => participant.calendarEventId)
          .filter((eventId): eventId is string => Boolean(eventId)),
      ),
    ];

    this.logger.log(
      `Calendar meeting lookup for ${normalizedEmail}: ${matchedEventIds.length} upcoming event(s)`,
    );

    return {
      hasUpcomingMeeting: matchedEventIds.length > 0,
      matchedEventIds,
    };
  }

  async hasUpcomingMeetingForPersonId(
    personId: string,
  ): Promise<UpcomingMeetingLookupResult> {
    if (!personId) {
      return { hasUpcomingMeeting: false, matchedEventIds: [] };
    }

    const personRepository =
      await this.twentyORMManager.getRepository<PersonWorkspaceEntity>('person');

    const person = await personRepository.findOne({
      where: { id: personId },
    });

    const primaryEmail = person?.emails?.primaryEmail;

    if (primaryEmail) {
      return this.hasUpcomingMeetingForEmail(primaryEmail);
    }

    const participantRepository =
      await this.twentyORMManager.getRepository<CalendarEventParticipantWorkspaceEntity>(
        'calendarEventParticipant',
      );

    const participants = await participantRepository
      .createQueryBuilder('participant')
      .innerJoin('participant.calendarEvent', 'event')
      .where('participant.personId = :personId', { personId })
      .andWhere('event.isCanceled = false')
      .andWhere('event.startsAt >= :now', { now: new Date().toISOString() })
      .select(['participant.id', 'participant.calendarEventId'])
      .getMany();

    const matchedEventIds = [
      ...new Set(
        participants
          .map((participant) => participant.calendarEventId)
          .filter((eventId): eventId is string => Boolean(eventId)),
      ),
    ];

    this.logger.log(
      `Calendar meeting lookup for person ${personId}: ${matchedEventIds.length} upcoming event(s)`,
    );

    return {
      hasUpcomingMeeting: matchedEventIds.length > 0,
      matchedEventIds,
    };
  }

  async hasUpcomingMeetingForPersonEmail(
    email: string,
    personId?: string | null,
  ): Promise<UpcomingMeetingLookupResult> {
    if (personId) {
      const byPersonId = await this.hasUpcomingMeetingForPersonId(personId);

      if (byPersonId.hasUpcomingMeeting) {
        return byPersonId;
      }
    }

    return this.hasUpcomingMeetingForEmail(email);
  }
}
