import { UseGuards } from '@nestjs/common';
import { Args, ArgsType, Field, Int, Query, Resolver } from '@nestjs/graphql';

import { IsEmail, Max } from 'class-validator';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { CalendarMeetingLookupService } from 'src/engine/core-modules/calendar/calendar-meeting-lookup.service';
import { TIMELINE_CALENDAR_EVENTS_MAX_PAGE_SIZE } from 'src/engine/core-modules/calendar/constants/calendar.constants';
import { TimelineCalendarEventsWithTotal } from 'src/engine/core-modules/calendar/dtos/timeline-calendar-events-with-total.dto';
import { TimelineCalendarEventService } from 'src/engine/core-modules/calendar/timeline-calendar-event.service';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

@ArgsType()
class GetTimelineCalendarEventsFromPersonIdArgs {
  @Field(() => UUIDScalarType)
  personId: string;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  @Max(TIMELINE_CALENDAR_EVENTS_MAX_PAGE_SIZE)
  pageSize: number;
}

@ArgsType()
class HasUpcomingMeetingForPersonEmailArgs {
  @Field(() => String)
  @IsEmail()
  email: string;

  @Field(() => UUIDScalarType, { nullable: true })
  personId?: string | null;
}

@ArgsType()
class GetTimelineCalendarEventsFromCompanyIdArgs {
  @Field(() => UUIDScalarType)
  companyId: string;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  @Max(TIMELINE_CALENDAR_EVENTS_MAX_PAGE_SIZE)
  pageSize: number;
}

@UseGuards(WorkspaceAuthGuard)
@Resolver(() => TimelineCalendarEventsWithTotal)
export class TimelineCalendarEventResolver {
  constructor(
    private readonly timelineCalendarEventService: TimelineCalendarEventService,
    private readonly calendarMeetingLookupService: CalendarMeetingLookupService,
  ) {}

  @Query(() => TimelineCalendarEventsWithTotal)
  async getTimelineCalendarEventsFromPersonId(
    @Args()
    { personId, page, pageSize }: GetTimelineCalendarEventsFromPersonIdArgs,
  ) {
    const timelineCalendarEvents =
      await this.timelineCalendarEventService.getCalendarEventsFromPersonIds(
        [personId],
        page,
        pageSize,
      );

    return timelineCalendarEvents;
  }

  @Query(() => Boolean)
  async hasUpcomingMeetingForPersonEmail(
    @Args()
    { email, personId }: HasUpcomingMeetingForPersonEmailArgs,
  ): Promise<boolean> {
    const result =
      await this.calendarMeetingLookupService.hasUpcomingMeetingForPersonEmail(
        email,
        personId,
      );

    return result.hasUpcomingMeeting;
  }

  @Query(() => TimelineCalendarEventsWithTotal)
  async getTimelineCalendarEventsFromCompanyId(
    @Args()
    { companyId, page, pageSize }: GetTimelineCalendarEventsFromCompanyIdArgs,
  ) {
    const timelineCalendarEvents =
      await this.timelineCalendarEventService.getCalendarEventsFromCompanyId(
        companyId,
        page,
        pageSize,
      );

    return timelineCalendarEvents;
  }
}
