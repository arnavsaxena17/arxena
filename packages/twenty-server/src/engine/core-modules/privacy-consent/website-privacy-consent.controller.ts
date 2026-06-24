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

import { RecordWebsitePrivacyConsentDto } from './dto/record-website-privacy-consent.dto';
import { PrivacyConsentService } from './privacy-consent.service';

@Controller('website')
export class WebsitePrivacyConsentController {
  private readonly logger = new Logger(WebsitePrivacyConsentController.name);

  constructor(
    private readonly privacyConsentService: PrivacyConsentService,
    private readonly environmentService: EnvironmentService,
  ) {}

  @Post('privacy-consent')
  async recordWebsitePrivacyConsent(
    @Req() req: Request,
    @Body() body: RecordWebsitePrivacyConsentDto,
  ): Promise<{ success: true }> {
    if (!isOrgChartPdlProxyAuthorized(req, this.environmentService)) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    try {
      await this.privacyConsentService.recordWebsiteCookieConsent(body, {
        userAgent: req.headers['user-agent'],
      });

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to record website privacy consent for visitorId=${body.visitorId}`,
        error instanceof Error ? error.stack : error,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Unable to save your cookie preferences. Please try again.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
