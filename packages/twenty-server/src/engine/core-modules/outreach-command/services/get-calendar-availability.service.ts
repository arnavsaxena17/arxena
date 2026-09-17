import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import moment from 'moment-timezone';

import { GoogleCalendarService } from 'src/engine/core-modules/calendar-events/google-calendar.service';
import { OutreachWorkspaceAuthTokenService } from 'src/engine/core-modules/outreach-command/services/outreach-workspace-auth-token.service';

// Flip to false for hardcoded weekday slots (no Google call)
const USE_LIVE_GOOGLE_CALENDAR = true;

const DEFAULT_AVAILABILITY_TIMEZONE = 'Asia/Kolkata';
const DEFAULT_WINDOW_START_HOUR = 10;
const DEFAULT_WINDOW_END_HOUR = 17;
const DEFAULT_MAX_SLOTS = 12;

export type GetCalendarAvailabilityInput = {
  workspaceMemberId?: string;
  days?: number;
  slotMinutes?: number;
};

export type CalendarSlot = {
  startsAt: string;
  endsAt: string;
};

// Always-available weekday windows when Google Calendar is not connected.
const buildDefaultAlwaysAvailableSlots = ({
  days,
  slotMinutes,
}: {
  days: number;
  slotMinutes: number;
}): CalendarSlot[] => {
  const slots: CalendarSlot[] = [];
  const cursor = moment
    .tz(DEFAULT_AVAILABILITY_TIMEZONE)
    .add(1, 'day')
    .hour(DEFAULT_WINDOW_START_HOUR)
    .minute(0)
    .second(0)
    .millisecond(0);
  const latest = moment
    .tz(DEFAULT_AVAILABILITY_TIMEZONE)
    .add(days, 'days')
    .endOf('day');

  while (cursor.isBefore(latest) && slots.length < DEFAULT_MAX_SLOTS) {
    const hour = cursor.hour();
    const weekday = cursor.isoWeekday();

    if (
      weekday <= 5 &&
      hour >= DEFAULT_WINDOW_START_HOUR &&
      hour < DEFAULT_WINDOW_END_HOUR
    ) {
      const slotEnd = cursor.clone().add(slotMinutes, 'minutes');

      slots.push({
        startsAt: cursor.toISOString(),
        endsAt: slotEnd.toISOString(),
      });
    }

    cursor.add(slotMinutes, 'minutes');

    if (cursor.hour() >= DEFAULT_WINDOW_END_HOUR) {
      cursor
        .add(1, 'day')
        .hour(DEFAULT_WINDOW_START_HOUR)
        .minute(0)
        .second(0)
        .millisecond(0);
    }
  }

  return slots;
};

@Injectable()
export class GetCalendarAvailabilityService {
  private readonly logger = new Logger(GetCalendarAvailabilityService.name);

  constructor(
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly gtmWorkspaceAuthTokenService: OutreachWorkspaceAuthTokenService,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: GetCalendarAvailabilityInput;
  }): Promise<{
    success: boolean;
    slots: CalendarSlot[];
    error?: string;
  }> {
    const days = Math.min(Math.max(1, input.days ?? 5), 14);
    const slotMinutes = Math.min(Math.max(15, input.slotMinutes ?? 30), 120);
    const timeMin = moment().startOf('hour').toISOString();
    const timeMax = moment().add(days, 'days').endOf('day').toISOString();

    if (!USE_LIVE_GOOGLE_CALENDAR) {
      const slots = buildDefaultAlwaysAvailableSlots({ days, slotMinutes });

      this.logger.log(
        `USE_LIVE_GOOGLE_CALENDAR=false: default IST slots (${slots.length})`,
      );

      return { success: true, slots, error: '' };
    }

    const fallbackToDefaultAvailability = (reason: string) => {
      const slots = buildDefaultAlwaysAvailableSlots({ days, slotMinutes });

      this.logger.warn(
        `get-calendar-availability: ${reason}; using default 10:00-17:00 IST slots (${slots.length})`,
      );

      return { success: true, slots, error: '' };
    };

    try {
      const apiToken =
        await this.gtmWorkspaceAuthTokenService.resolveOrMint(workspaceId);

      if (!isNonEmptyString(apiToken)) {
        return fallbackToDefaultAvailability('Workspace API token unavailable');
      }

      const auth = await this.googleCalendarService.authorize(apiToken);

      if (!auth?.credentials?.refresh_token) {
        return fallbackToDefaultAvailability('Google Calendar not connected');
      }

      const events = (await this.googleCalendarService.listEvents(
        auth,
        timeMin,
        timeMax,
      )) as Array<{
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
      }>;

      const busy = (events ?? [])
        .map((event) => ({
          start: moment(event.start?.dateTime ?? event.start?.date),
          end: moment(event.end?.dateTime ?? event.end?.date),
        }))
        .filter((range) => range.start.isValid() && range.end.isValid());

      const slots: CalendarSlot[] = [];
      const cursor = moment().add(1, 'hour').startOf('hour');
      const latest = moment(timeMax);

      while (cursor.isBefore(latest) && slots.length < DEFAULT_MAX_SLOTS) {
        const hour = cursor.hour();
        const weekday = cursor.isoWeekday();

        if (weekday <= 5 && hour >= 9 && hour < 17) {
          const slotEnd = cursor.clone().add(slotMinutes, 'minutes');
          const overlaps = busy.some(
            (range) =>
              cursor.isBefore(range.end) && slotEnd.isAfter(range.start),
          );

          if (!overlaps) {
            slots.push({
              startsAt: cursor.toISOString(),
              endsAt: slotEnd.toISOString(),
            });
          }
        }

        cursor.add(slotMinutes, 'minutes');
      }

      return {
        success: true,
        slots,
        error: '',
      };
    } catch (error) {
      this.logger.error('get-calendar-availability failed', error);

      return fallbackToDefaultAvailability(
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
