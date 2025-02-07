import { CalendarEventType } from '../../calendar-events/services/calendar-data-objects-types';
import { GoogleCalendarController } from '../../calendar-events/google-calendar.controller';
import { GoogleCalendarService } from '../../calendar-events/google-calendar.service';

export class CalendarEmailService {

async createNewCalendarEvent(calendarEventData: CalendarEventType, apiToken: string) {
    // Create a new calendar event
    const googleCalendarService = new GoogleCalendarService();
    const googleCalendarController =  new GoogleCalendarController(googleCalendarService);
    const request = { headers: { authorization: `Bearer ${apiToken}` }, body: calendarEventData };
    const response = await googleCalendarController.createEventOfController(request as any).catch(console.error);
    // console.log("This is the response from the calendar event creation", calendarEventResponse.data);
    return response;
}


async getCalendarEvents(params: any, apiToken: string) {
    const googleCalendarService = new GoogleCalendarService();
    const googleCalendarController = new GoogleCalendarController(googleCalendarService);
    const request = { headers: { authorization: `Bearer ${apiToken}` }, query: params };
    const response = await googleCalendarController.getEventsOfController(request as any).catch(console.error);
    return response;
}

}