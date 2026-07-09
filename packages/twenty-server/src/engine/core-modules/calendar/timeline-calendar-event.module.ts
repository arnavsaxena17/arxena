import { Module } from '@nestjs/common';

import { CalendarMeetingLookupService } from 'src/engine/core-modules/calendar/calendar-meeting-lookup.service';
import { TimelineCalendarEventResolver } from 'src/engine/core-modules/calendar/timeline-calendar-event.resolver';
import { TimelineCalendarEventService } from 'src/engine/core-modules/calendar/timeline-calendar-event.service';
import { UserModule } from 'src/engine/core-modules/user/user.module';

@Module({
  imports: [UserModule],
  exports: [CalendarMeetingLookupService, TimelineCalendarEventService],
  providers: [
    CalendarMeetingLookupService,
    TimelineCalendarEventResolver,
    TimelineCalendarEventService,
  ],
})
export class TimelineCalendarEventModule {}
