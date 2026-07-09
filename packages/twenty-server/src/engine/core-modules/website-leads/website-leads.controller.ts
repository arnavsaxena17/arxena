import {
    Body,
    Controller,
    HttpException,
    HttpStatus,
    Logger,
    Post,
    Req,
} from '@nestjs/common';

import { Request } from 'express';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { isOrgChartPdlProxyAuthorized } from 'src/engine/core-modules/org-chart/utils/org-chart-pdl-proxy.util';

import { FreeTrialLeadDto } from './dto/free-trial-lead.dto';
import { CalendlyBookingCompletedDto } from './dto/calendly-booking-completed.dto';
import { CalendlyBookingCompletedService } from './calendly-booking-completed.service';
import { WebsiteLeadsService } from './website-leads.service';

@Controller('website')
export class WebsiteLeadsController {
  private readonly logger = new Logger(WebsiteLeadsController.name);

  constructor(
    private readonly websiteLeadsService: WebsiteLeadsService,
    private readonly calendlyBookingCompletedService: CalendlyBookingCompletedService,
    private readonly environmentService: EnvironmentService,
  ) {}

  @Post('free-trial-lead')
  async submitFreeTrialLead(
    @Req() req: Request,
    @Body() body: FreeTrialLeadDto,
  ): Promise<{ success: true; emailSent: true }> {
    if (!isOrgChartPdlProxyAuthorized(req, this.environmentService)) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    try {
      await this.websiteLeadsService.sendFreeTrialLeadNotification(body);

      return { success: true, emailSent: true };
    } catch (error) {
      this.logger.error(
        `Failed to queue free trial lead email for ${body.email}`,
        error instanceof Error ? error.stack : error,
      );

      throw new HttpException(
        'Unable to submit your request. Please try again.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('calendly-booking-completed')
  async submitCalendlyBookingCompleted(
    @Req() req: Request,
    @Body() body: CalendlyBookingCompletedDto,
  ): Promise<{
    success: true;
    opportunityId?: string;
    meetingScheduledAt?: string;
  }> {
    if (!isOrgChartPdlProxyAuthorized(req, this.environmentService)) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    try {
      const result =
        await this.calendlyBookingCompletedService.markMeetingScheduledForLead(
          body,
        );

      return {
        success: true,
        opportunityId: result?.opportunityId,
        meetingScheduledAt: result?.meetingScheduledAt,
      };
    } catch (error) {
      this.logger.error(
        `Failed to process Calendly booking for ${body.email}`,
        error instanceof Error ? error.stack : error,
      );

      throw new HttpException(
        'Unable to record your booking. Please try again.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
