import { Controller, Post, Body } from "@nestjs/common";
import { GoogleCalendarService } from "./google-calendar.service";
import { CalendarEventType } from "src/engine/core-modules/calendar-events/services/calendar-data-objects-types";

@Controller("google-calendar")
export class GoogleCalendarController {
  constructor(private readonly googleCalendarService: GoogleCalendarService) {}

  @Post("create-event")
  async createEventOfController(
    @Body() calendarEventDataObj: CalendarEventType
  ): Promise<object> {
    console.log("Calendar create event request body::", calendarEventDataObj);
    try {
      const auth = await this.googleCalendarService.authorize();
      await this.googleCalendarService.createEvent(auth, calendarEventDataObj);
      return { status: "Event created successfully" };
    } catch (error) {
      console.error("Error creating event: ", error);
      return { status: "Error creating event", error: error.message };
    }
  }
}
