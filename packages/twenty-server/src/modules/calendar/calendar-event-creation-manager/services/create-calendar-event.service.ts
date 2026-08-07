import { Injectable, Logger } from '@nestjs/common';

import { ConnectedAccountProvider } from 'twenty-shared/types';

import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { CalDavCreateEventService } from 'src/modules/calendar/calendar-event-creation-manager/drivers/caldav/services/caldav-create-event.service';
import { GoogleCalendarCreateEventService } from 'src/modules/calendar/calendar-event-creation-manager/drivers/google-calendar/services/google-calendar-create-event.service';
import { MicrosoftCalendarCreateEventService } from 'src/modules/calendar/calendar-event-creation-manager/drivers/microsoft-calendar/services/microsoft-calendar-create-event.service';
import {
  CalendarEventCreationException,
  CalendarEventCreationExceptionCode,
} from 'src/modules/calendar/calendar-event-creation-manager/exceptions/calendar-event-creation.exception';
import { CalendarSaveEventsService } from 'src/modules/calendar/calendar-event-import-manager/services/calendar-save-events.service';
import { type ComposedCalendarEvent } from 'src/modules/calendar/calendar-event-creation-manager/types/composed-calendar-event.type';
import { type FetchedCalendarEvent } from 'src/modules/calendar/common/types/fetched-calendar-event';
import { type CalendarEventWorkspaceEntity } from 'src/modules/calendar/common/standard-objects/calendar-event.workspace-entity';

@Injectable()
export class CreateCalendarEventService {
  private readonly logger = new Logger(CreateCalendarEventService.name);

  constructor(
    private readonly googleCalendarCreateEventService: GoogleCalendarCreateEventService,
    private readonly microsoftCalendarCreateEventService: MicrosoftCalendarCreateEventService,
    private readonly calDavCreateEventService: CalDavCreateEventService,
    private readonly calendarSaveEventsService: CalendarSaveEventsService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async createComposedCalendarEvent(
    data: ComposedCalendarEvent,
  ): Promise<FetchedCalendarEvent> {
    switch (data.connectedAccount.provider) {
      case ConnectedAccountProvider.GOOGLE:
        return this.googleCalendarCreateEventService.createCalendarEvent(
          data.input,
          data.connectedAccount,
        );
      case ConnectedAccountProvider.MICROSOFT:
        return this.microsoftCalendarCreateEventService.createCalendarEvent(
          data.input,
          data.connectedAccount,
        );
      case ConnectedAccountProvider.IMAP_SMTP_CALDAV:
        return this.calDavCreateEventService.createCalendarEvent(
          data.input,
          data.connectedAccount,
        );
      default:
        throw new CalendarEventCreationException(
          `Calendar event creation is not supported for provider ${data.connectedAccount.provider}`,
          CalendarEventCreationExceptionCode.PROVIDER_NOT_SUPPORTED,
        );
    }
  }

  // Persist the created event right away so it is immediately visible in Twenty.
  // The next provider sync reconciles it via its external id, so a persistence
  // failure here is non-fatal.
  async persistCalendarEvent(
    createdEvent: FetchedCalendarEvent,
    data: ComposedCalendarEvent,
    workspaceId: string,
  ): Promise<void> {
    try {
      await this.calendarSaveEventsService.saveCalendarEventsAndEnqueueContactCreationJob(
        [createdEvent],
        data.calendarChannel,
        data.connectedAccount,
        workspaceId,
      );

      await this.markEventAsGtmSourced(createdEvent, workspaceId);
    } catch (persistenceError) {
      this.logger.warn(
        `Failed to persist created calendar event (sync will recover): ${persistenceError}`,
      );
    }
  }

  private async markEventAsGtmSourced(
    createdEvent: FetchedCalendarEvent,
    workspaceId: string,
  ): Promise<void> {
    if (!createdEvent.iCalUid && !createdEvent.id) {
      return;
    }

    try {
      const authContext = buildSystemAuthContext(workspaceId);

      await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const calendarEventRepository =
            await this.globalWorkspaceOrmManager.getRepository<CalendarEventWorkspaceEntity>(
              workspaceId,
              'calendarEvent',
            );

          const where = createdEvent.iCalUid
            ? { iCalUid: createdEvent.iCalUid }
            : { id: createdEvent.id };

          await calendarEventRepository.update(where, {
            gtmSourced: true,
            meetingOutcome: 'BOOKED',
          } as Partial<CalendarEventWorkspaceEntity> & {
            gtmSourced: boolean;
            meetingOutcome: string;
          });
        },
        authContext,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to mark calendar event as GTM-sourced: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
