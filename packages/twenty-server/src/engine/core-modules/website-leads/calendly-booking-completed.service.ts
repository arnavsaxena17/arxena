import { Injectable, Logger } from '@nestjs/common';

import {
  applyOutreachAnalyticsEvent,
  parseOutreachAnalytics,
} from 'twenty-shared/arx';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { TwentyORMGlobalManager } from 'src/engine/twenty-orm/twenty-orm-global.manager';
import { CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

import { CalendlyBookingCompletedDto } from './dto/calendly-booking-completed.dto';

export type CalendlyBookingCompletedResult = {
  opportunityId: string;
  personId: string;
  meetingScheduledAt: string;
};

@Injectable()
export class CalendlyBookingCompletedService {
  private readonly logger = new Logger(CalendlyBookingCompletedService.name);

  constructor(
    private readonly twentyORMGlobalManager: TwentyORMGlobalManager,
    private readonly environmentService: EnvironmentService,
  ) {}

  private getWorkspaceId(): string | null {
    return this.environmentService.get('FREE_TRIAL_LEAD_WORKSPACE_ID') ?? null;
  }

  private resolveScheduledAt(input: CalendlyBookingCompletedDto): Date {
    if (input.scheduledAt) {
      const parsed = new Date(input.scheduledAt);

      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return new Date();
  }

  private resolveCalendlyUris(input: CalendlyBookingCompletedDto): {
    calendlyEventUri?: string;
    calendlyInviteeUri?: string;
  } {
    return {
      calendlyEventUri:
        input.calendlyEventUri ?? input.calendlyPayload?.event?.uri,
      calendlyInviteeUri:
        input.calendlyInviteeUri ?? input.calendlyPayload?.invitee?.uri,
    };
  }

  async markMeetingScheduledForLead(
    input: CalendlyBookingCompletedDto,
  ): Promise<CalendlyBookingCompletedResult | null> {
    const workspaceId = this.getWorkspaceId();

    if (!workspaceId) {
      this.logger.warn(
        'FREE_TRIAL_LEAD_WORKSPACE_ID is not configured; skipping Calendly booking update',
      );

      return null;
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const meetingScheduledAt = this.resolveScheduledAt(input);
    const { calendlyEventUri, calendlyInviteeUri } =
      this.resolveCalendlyUris(input);

    const personRepository =
      await this.twentyORMGlobalManager.getRepositoryForWorkspace(
        workspaceId,
        PersonWorkspaceEntity,
      );
    const opportunityRepository =
      await this.twentyORMGlobalManager.getRepositoryForWorkspace(
        workspaceId,
        OpportunityWorkspaceEntity,
      );

    const person = await personRepository.findOne({
      where: {
        emails: {
          primaryEmail: normalizedEmail,
        },
      },
    });

    if (!person) {
      this.logger.warn(
        `No person found for Calendly booking email ${normalizedEmail}`,
      );

      return null;
    }

    const opportunities = await opportunityRepository.find({
      where: {
        pointOfContactId: person.id,
      },
      order: {
        createdAt: 'DESC',
      },
      take: 5,
    });

    const opportunity =
      opportunities.find((item) => item.name.startsWith('Free Trial')) ??
      opportunities[0];

    if (!opportunity) {
      this.logger.warn(
        `No opportunity found for Calendly booking email ${normalizedEmail}`,
      );

      return null;
    }

    await opportunityRepository.update(opportunity.id, {
      meetingScheduledAt,
      stage: 'MEETING',
    });

    const companyId = opportunity.companyId ?? person.companyId;

    if (companyId) {
      try {
        const companyRepository =
          await this.twentyORMGlobalManager.getRepositoryForWorkspace(
            workspaceId,
            CompanyWorkspaceEntity,
          );
        const company = await companyRepository.findOne({
          where: { id: companyId },
        });
        const meetingBookedAtIso = meetingScheduledAt.toISOString();

        await companyRepository.update(companyId, {
          outreachAnalytics: applyOutreachAnalyticsEvent({
            existing: parseOutreachAnalytics(
              (company as { outreachAnalytics?: unknown } | null)
                ?.outreachAnalytics,
            ),
            event: 'meeting_booked',
            nowIso: meetingBookedAtIso,
          }),
          outreachFunnelStage: 'MEETING_BOOKED',
        } as Partial<CompanyWorkspaceEntity> & {
          outreachAnalytics: object;
          outreachFunnelStage: string;
        });
      } catch (error) {
        this.logger.warn(
          `Could not materialize company meeting booked for Calendly: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    this.logger.log(
      `Marked opportunity ${opportunity.id} meeting scheduled for ${normalizedEmail} (event=${calendlyEventUri ?? 'n/a'}, invitee=${calendlyInviteeUri ?? 'n/a'})`,
    );

    return {
      opportunityId: opportunity.id,
      personId: person.id,
      meetingScheduledAt: meetingScheduledAt.toISOString(),
    };
  }
}
