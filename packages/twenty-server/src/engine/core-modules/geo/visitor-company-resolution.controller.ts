import { Controller, Get, Headers, Query, Req } from '@nestjs/common';

import { Request } from 'express';

import { OrgChartClientIpService } from 'src/engine/core-modules/org-chart/services/org-chart-client-ip.service';
import { VisitorCompanyResolutionService } from 'src/engine/core-modules/geo/visitor-company-resolution.service';

/**
 * Unauthenticated visitor-deanonymization endpoint. Resolves the caller's IP to
 * a company and records it in ClickHouse. Intentionally public (it is a tracking
 * call fired from the public marketing site). GDPR: the caller is responsible
 * for consent before firing this for EU traffic.
 */
@Controller('visitor-company-resolution')
export class VisitorCompanyResolutionController {
  constructor(
    private readonly visitorCompanyResolutionService: VisitorCompanyResolutionService,
  ) {}

  @Get()
  async resolve(@Req() req: Request, @Query('path') path?: string, @Query('workspaceId') workspaceId?: string, @Headers('x-forwarded-for') xff?: string) {
    const ip =
      OrgChartClientIpService.extractClientIpFromRequest(req) ??
      (xff ? xff.split(',')[0].trim() : null) ??
      (req.ip as string | undefined) ??
      null;

    if (!ip) {
      return { error: 'could not determine client ip' };
    }

    const result = await this.visitorCompanyResolutionService.resolveAndRecord(
      ip,
      { path, workspaceId },
    );

    return result;
  }
}
