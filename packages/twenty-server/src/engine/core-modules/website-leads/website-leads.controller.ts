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
import { WebsiteLeadsService } from './website-leads.service';

@Controller('website')
export class WebsiteLeadsController {
  private readonly logger = new Logger(WebsiteLeadsController.name);

  constructor(
    private readonly websiteLeadsService: WebsiteLeadsService,
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
}
