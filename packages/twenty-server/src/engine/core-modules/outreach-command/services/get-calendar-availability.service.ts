import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import moment from 'moment';
import { FeatureFlagKey } from 'twenty-shared/types';

import { GoogleCalendarService } from 'src/engine/core-modules/calendar-events/google-calendar.service';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { OutreachWorkspaceAuthTokenService } from 'src/engine/core-modules/outreach-command/services/outreach-workspace-auth-token.service';

export type GetCalendarAvailabilityInput = {
  workspaceMemberId?: string;
  days?: number;
  slotMinutes?: number;
};

export type CalendarSlot = {
  startsAt: string;
  endsAt: string;
};

@Injectable()
export class GetCalendarAvailabilityService {
  private readonly logger = new Logger(GetCalendarAvailabilityService.name);

  constructor(
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly gtmWorkspaceAuthTokenService: OutreachWorkspaceAuthTokenService,
    private readonly featureFlagService: FeatureFlagService,
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

    const isOutreachMockEnabled =
      await this.featureFlagService.isFeatureEnabled(
        FeatureFlagKey.IS_OUTREACH_MOCK_UNIPILE_ENABLED,
        workspaceId,
      );

    if (isOutreachMockEnabled) {
      const slots: CalendarSlot[] = [];
      const cursor = moment().add(1, 'day').hour(11).minute(0).second(0);

      while (slots.length < 6) {
        if (cursor.isoWeekday() <= 5) {
          slots.push({
            startsAt: cursor.toISOString(),
            endsAt: cursor.clone().add(slotMinutes, 'minutes').toISOString(),
          });
        }
        cursor.add(1, 'day');
      }

      this.logger.log(
        `IS_OUTREACH_MOCK_UNIPILE_ENABLED: mock calendar slots (${slots.length})`,
      );

      return { success: true, slots, error: '' };
    }

    try {
      const apiToken =
        await this.gtmWorkspaceAuthTokenService.resolveOrMint(workspaceId);

      if (!isNonEmptyString(apiToken)) {
        return {
          success: false,
          slots: [],
          error: 'Workspace API token is required for calendar availability',
        };
      }

      const auth = await this.googleCalendarService.authorize(apiToken);
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

      while (cursor.isBefore(latest) && slots.length < 12) {
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

      return {
        success: false,
        slots: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
