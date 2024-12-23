import { Controller, Post, Body, UseGuards, Req } from "@nestjs/common";
import { Request } from "express";
import { GoogleCalendarService } from "./google-calendar.service";
import { CalendarEventType } from "../../../engine/core-modules/calendar-events/services/calendar-data-objects-types";
import { JwtAuthGuard } from "src/engine/guards/jwt.auth.guard";

@Controller("google-calendar")
export class GoogleCalendarController {
  constructor(private readonly googleCalendarService: GoogleCalendarService) {}

  @Post("create-event")
  @UseGuards(JwtAuthGuard)
  async createEventOfController(
    @Req() request: Request
  ): Promise<object> {
    const apiToken = request?.headers?.authorization?.split(' ')[1] || "";
    const calendarEventDataObj: CalendarEventType = request.body;
    try {
      const auth = await this.googleCalendarService.authorize(apiToken);
      const eventCreationResponse = await this.googleCalendarService.createEvent(auth, calendarEventDataObj);
      console.log("Event creation response::", eventCreationResponse);
      return { status: eventCreationResponse };
    } catch (error) {
      console.error("Error creating event: ", error);
      return { status: "Error creating event", error: error.message };
    }
  }
}
