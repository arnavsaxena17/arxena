import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Request } from 'express';

import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { TheOrgService } from 'src/engine/core-modules/theorg/services/theorg.service';
import { TheOrgJobService } from 'src/engine/core-modules/theorg/services/theorg-job.service';

@Controller('theorg')
@UseGuards(JwtAuthGuard)
export class TheOrgController {
  constructor(
    private readonly theOrgService: TheOrgService,
    private readonly theOrgJobService: TheOrgJobService,
  ) {}

  @Get('company/:slug')
  async getCompany(
    @Req() req: Request & { workspaceId?: string },
    @Param('slug') slug: string,
    @Query('includePeopleProfiles') includePeopleProfiles?: string,
    @Query('mode') mode?: string,
  ) {
    try {
      const result = await this.theOrgService.fetchCompanyDetails(slug, {
        mode:
          mode === 'teams' ||
          mode === 'orgchart' ||
          mode === 'offices' ||
          mode === 'combined'
            ? mode
            : undefined,
        includePeopleProfiles: ['1', 'true', 'yes', 'y'].includes(
          String(includePeopleProfiles || '').trim().toLowerCase(),
        ),
      });

      if (result.peopleProfilesDeferred) {
        const jobId = await this.theOrgJobService.queueCompanyProfileEnrichment(
          result.slug,
          req.workspaceId,
        );

        return {
          ...result,
          asyncProfileEnrichmentJob: {
            jobId,
            status: 'queued',
            statusEndpoint: `/theorg/jobs/${jobId}`,
          },
        };
      }

      return result;
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'TheOrg company fetch failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('person/:companySlug/:personSlug')
  async getPerson(
    @Param('companySlug') companySlug: string,
    @Param('personSlug') personSlug: string,
  ) {
    try {
      return await this.theOrgService.fetchPersonProfileBySlugs(
        companySlug,
        personSlug,
      );
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'TheOrg person fetch failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('jobs/:jobId')
  async getJob(@Param('jobId') jobId: string) {
    const progress = await this.theOrgJobService.getJobProgress(jobId);

    if (!progress) {
      throw new HttpException('TheOrg job not found', HttpStatus.NOT_FOUND);
    }

    return progress;
  }
}
