import { Injectable } from '@nestjs/common';

import { GoogleCalendarService } from 'src/engine/core-modules/calendar-events/google-calendar.service';
import { CalendarEventType } from 'src/engine/core-modules/calendar-events/services/calendar-data-objects-types';

@Injectable()
export class CalendarEmailService {
  constructor(
    private readonly googleCalendarService: GoogleCalendarService,
  ) {}

  async createNewCalendarEvent(
    calendarEventData: CalendarEventType,
    apiToken: string,
  ) {
    try {
      const auth = await this.googleCalendarService.authorize(apiToken);
      return await this.googleCalendarService.createEvent(
        auth,
        calendarEventData,
      );
    } catch (error) {
      console.error('Error creating calendar event: ', error);
      throw error;
    }
  }

  async getCalendarEvents(
    params: { timeMin?: string; timeMax?: string },
    apiToken: string,
  ) {
    try {
      const auth = await this.googleCalendarService.authorize(apiToken);
      const events = await this.googleCalendarService.listEvents(
        auth,
        params?.timeMin,
        params?.timeMax,
      );

      return {
        status: 'success',
        data: events,
      };
    } catch (error) {
      console.error('Error fetching calendar events: ', error);
      throw error;
    }
  }
}
