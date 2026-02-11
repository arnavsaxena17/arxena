import {
    Body,
    Controller,
    Get,
    Logger,
    Param,
    Post,
    Query,
    UseGuards
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

import { ContactEnrichmentJobService } from '../services/contact-enrichment-job.service';
import { ContactEnrichmentWaterfallService } from '../services/contact-enrichment-waterfall.service';
import type {
    ContactAvailability,
    ContactEnrichmentOptions,
    ContactResult,
} from '../types/contact-enrichment.types';

@Controller('contact-enrichment')
@UseGuards(JwtAuthGuard)
export class ContactEnrichmentController {
  private readonly logger = new Logger(ContactEnrichmentController.name);

  constructor(
    private readonly waterfallService: ContactEnrichmentWaterfallService,
    private readonly jobService: ContactEnrichmentJobService,
  ) {}

  /**
   * Check availability of email/phone for LinkedIn profile(s).
   * GET /contact-enrichment/availability?linkedinUrl=... or POST with body
   */
  @Get('availability')
  @Post('availability')
  async checkAvailability(
    @Query('linkedinUrl') linkedinUrl?: string,
    @Body() body?: { linkedinUrl?: string; linkedinUrls?: string[] },
  ): Promise<
    | ContactAvailability
    | { jobId: string; status: string; total: number }
    | { results: Record<string, ContactAvailability> }
  > {
    const urls: string[] = [];

    // Get URLs from query or body
    if (linkedinUrl) {
      urls.push(linkedinUrl);
    } else if (body?.linkedinUrl) {
      urls.push(body.linkedinUrl);
    } else if (body?.linkedinUrls && Array.isArray(body.linkedinUrls)) {
      urls.push(...body.linkedinUrls);
    }

    if (urls.length === 0) {
      throw new Error('linkedinUrl or linkedinUrls must be provided');
    }

    // Check if we should process async
    if (this.jobService.shouldProcessAsync(urls.length)) {
      const jobId = await this.jobService.queueBulkJob(
        urls,
        'availability',
      );
      return {
        jobId,
        status: 'queued',
        total: urls.length,
      };
    }

    // Process synchronously
    const results: Record<string, ContactAvailability> = {};
    for (const url of urls) {
      try {
        results[url] = await this.waterfallService.checkAvailability(url);
      } catch (error) {
        this.logger.error(`Availability check failed for ${url}`, error as Error);
        results[url] = {
          emailAvailable: false,
          phoneAvailable: false,
        };
      }
    }

    // Return single result if single URL, otherwise return results object
    if (urls.length === 1) {
      return results[urls[0]];
    }

    return { results };
  }

  /**
   * Fetch contacts for LinkedIn profile(s).
   * POST /contact-enrichment/fetch
   */
  @Post('fetch')
  async fetchContacts(
    @Body()
    body: {
      linkedinUrl?: string;
      linkedinUrls?: string[];
      wantEmail?: boolean;
      wantPhone?: boolean;
    },
  ): Promise<
    | ContactResult
    | { jobId: string; status: string; total: number }
    | { results: Record<string, ContactResult> }
  > {
    const urls: string[] = [];

    // Get URLs from body
    if (body.linkedinUrl) {
      urls.push(body.linkedinUrl);
    } else if (body.linkedinUrls && Array.isArray(body.linkedinUrls)) {
      urls.push(...body.linkedinUrls);
    }

    if (urls.length === 0) {
      throw new Error('linkedinUrl or linkedinUrls must be provided');
    }

    const options: ContactEnrichmentOptions = {
      wantEmail: body.wantEmail,
      wantPhone: body.wantPhone,
    };

    // Check if we should process async
    if (this.jobService.shouldProcessAsync(urls.length)) {
      const jobId = await this.jobService.queueBulkJob(urls, 'fetch', options);
      return {
        jobId,
        status: 'queued',
        total: urls.length,
      };
    }

    // Process synchronously
    const results: Record<string, ContactResult> = {};
    for (const url of urls) {
      try {
        results[url] = await this.waterfallService.fetchContacts(url, options);
      } catch (error) {
        this.logger.error(`Fetch failed for ${url}`, error as Error);
        results[url] = {
          emails: [],
          phones: [],
          source: 'error',
        };
      }
    }

    // Return single result if single URL, otherwise return results object
    if (urls.length === 1) {
      return results[urls[0]];
    }

    return { results };
  }

  /**
   * Get job progress and results.
   * GET /contact-enrichment/jobs/:jobId
   */
  @Get('jobs/:jobId')
  async getJobProgress(@Param('jobId') jobId: string) {
    const progress = await this.jobService.getJobProgress(jobId);

    if (!progress) {
      return {
        status: 'not_found',
        message: `Job ${jobId} not found`,
      };
    }

    return progress;
  }
}
