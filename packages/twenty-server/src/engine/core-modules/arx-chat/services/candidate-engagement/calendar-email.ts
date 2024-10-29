import axios from "axios";
import { CalendarEventType } from '../../../calendar-events/services/calendar-data-objects-types';
import { GoogleCalendarController } from '../../../calendar-events/google-calendar.controller';
import { GoogleCalendarService } from '../../../calendar-events/google-calendar.service';

export class CalendarEmailService {

async createNewCalendarEvent(calendarEventData: CalendarEventType) {
    // Create a new calendar event
    const googleCalendarService = new GoogleCalendarService();
    const googleCalendarController =  new GoogleCalendarController(googleCalendarService);
    const response = await googleCalendarController.createEventOfController(calendarEventData).catch(console.error);
    // console.log("This is the response from the calendar event creation", calendarEventResponse.data);
    return response;
}

}