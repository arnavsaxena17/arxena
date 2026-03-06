import {
    Body,
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Logger,
    Param,
    Post,
    Query,
    Req,
    UseGuards
} from '@nestjs/common';

import { Request } from 'express';

import { WorkspaceCreditsService } from 'src/engine/core-modules/billing/services/workspace-credits.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

import { ApolloProvider } from '../providers/apollo.provider';
import { ArxenaProvider } from '../providers/arxena.provider';
import { ContactOutProvider } from '../providers/contactout.provider';
import { LushaProvider } from '../providers/lusha.provider';
import { PdlProvider } from '../providers/pdl.provider';
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
    private readonly workspaceCreditsService: WorkspaceCreditsService,
    private readonly arxenaProvider: ArxenaProvider,
    private readonly pdlProvider: PdlProvider,
    private readonly contactOutProvider: ContactOutProvider,
    private readonly lushaProvider: LushaProvider,
    private readonly apolloProvider: ApolloProvider,
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
    @Req() req: Request & { workspaceId?: string },
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

    const wantEmail = options.wantEmail !== false;
    const wantPhone = options.wantPhone !== false;
    const workspaceId = req.workspaceId;

    if (
      process.env.IS_BILLING_ENABLED === 'true' &&
      workspaceId &&
      (wantEmail || wantPhone)
    ) {
      const totalEmailCredits = wantEmail ? urls.length : 0;
      const totalPhoneCredits = wantPhone ? urls.length : 0;
      const hasSufficient =
        await this.workspaceCreditsService.hasSufficientContactCreditsForCount(
          workspaceId,
          totalEmailCredits,
          totalPhoneCredits,
        );
      if (!hasSufficient) {
        throw new HttpException(
          'Insufficient contact credits',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // Check if we should process async
    if (this.jobService.shouldProcessAsync(urls.length)) {
      const jobId = await this.jobService.queueBulkJob(
        urls,
        'fetch',
        options,
        undefined,
        workspaceId,
      );
      return {
        jobId,
        status: 'queued',
        total: urls.length,
      };
    }

    // Process synchronously - debit per URL
    const results: Record<string, ContactResult> = {};
    for (const url of urls) {
      try {
        if (
          process.env.IS_BILLING_ENABLED === 'true' &&
          workspaceId &&
          (wantEmail || wantPhone)
        ) {
          await this.workspaceCreditsService.debitContactCredits(
            workspaceId,
            wantEmail ? 1 : 0,
            wantPhone ? 1 : 0,
            { linkedinUrl: url, source: 'contact_enrichment' },
          );
        }

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

  /**
   * Check availability using Arxena provider only.
   * GET/POST /contact-enrichment/availability/arxena
   */
  @Get('availability/arxena')
  @Post('availability/arxena')
  async checkAvailabilityArxena(
    @Query('linkedinUrl') linkedinUrl?: string,
    @Body() body?: { linkedinUrl?: string; linkedinUrls?: string[] },
  ): Promise<
    | ContactAvailability
    | { jobId: string; status: string; total: number }
    | { results: Record<string, ContactAvailability> }
  > {
    return this.checkAvailabilityForProvider('arxena', linkedinUrl, body);
  }

  /**
   * Check availability using PDL provider only.
   * GET/POST /contact-enrichment/availability/pdl
   */
  @Get('availability/pdl')
  @Post('availability/pdl')
  async checkAvailabilityPdl(
    @Query('linkedinUrl') linkedinUrl?: string,
    @Body() body?: { linkedinUrl?: string; linkedinUrls?: string[] },
  ): Promise<
    | ContactAvailability
    | { jobId: string; status: string; total: number }
    | { results: Record<string, ContactAvailability> }
  > {
    return this.checkAvailabilityForProvider('pdl', linkedinUrl, body);
  }

  /**
   * Check availability using ContactOut provider only.
   * GET/POST /contact-enrichment/availability/contactout
   */
  @Get('availability/contactout')
  @Post('availability/contactout')
  async checkAvailabilityContactOut(
    @Query('linkedinUrl') linkedinUrl?: string,
    @Body() body?: { linkedinUrl?: string; linkedinUrls?: string[] },
  ): Promise<
    | ContactAvailability
    | { jobId: string; status: string; total: number }
    | { results: Record<string, ContactAvailability> }
  > {
    return this.checkAvailabilityForProvider('contactout', linkedinUrl, body);
  }

  /**
   * Check availability using Lusha provider only.
   * GET/POST /contact-enrichment/availability/lusha
   */
  @Get('availability/lusha')
  @Post('availability/lusha')
  async checkAvailabilityLusha(
    @Query('linkedinUrl') linkedinUrl?: string,
    @Body() body?: { linkedinUrl?: string; linkedinUrls?: string[] },
  ): Promise<
    | ContactAvailability
    | { jobId: string; status: string; total: number }
    | { results: Record<string, ContactAvailability> }
  > {
    return this.checkAvailabilityForProvider('lusha', linkedinUrl, body);
  }

  /**
   * Check availability using Apollo provider only.
   * GET/POST /contact-enrichment/availability/apollo
   */
  @Get('availability/apollo')
  @Post('availability/apollo')
  async checkAvailabilityApollo(
    @Query('linkedinUrl') linkedinUrl?: string,
    @Body() body?: { linkedinUrl?: string; linkedinUrls?: string[] },
  ): Promise<
    | ContactAvailability
    | { jobId: string; status: string; total: number }
    | { results: Record<string, ContactAvailability> }
  > {
    return this.checkAvailabilityForProvider('apollo', linkedinUrl, body);
  }

  /**
   * Fetch contacts using Arxena provider only.
   * POST /contact-enrichment/fetch/arxena
   */
  @Post('fetch/arxena')
  async fetchContactsArxena(
    @Req() req: Request & { workspaceId?: string },
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
    return this.fetchContactsForProvider('arxena', req, body);
  }

  /**
   * Fetch contacts using PDL provider only.
   * POST /contact-enrichment/fetch/pdl
   */
  @Post('fetch/pdl')
  async fetchContactsPdl(
    @Req() req: Request & { workspaceId?: string },
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
    return this.fetchContactsForProvider('pdl', req, body);
  }

  /**
   * Fetch contacts using ContactOut provider only.
   * POST /contact-enrichment/fetch/contactout
   */
  @Post('fetch/contactout')
  async fetchContactsContactOut(
    @Req() req: Request & { workspaceId?: string },
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
    return this.fetchContactsForProvider('contactout', req, body);
  }

  /**
   * Fetch contacts using Lusha provider only.
   * POST /contact-enrichment/fetch/lusha
   */
  @Post('fetch/lusha')
  async fetchContactsLusha(
    @Req() req: Request & { workspaceId?: string },
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
    return this.fetchContactsForProvider('lusha', req, body);
  }

  /**
   * Fetch contacts using Apollo provider only.
   * POST /contact-enrichment/fetch/apollo
   */
  @Post('fetch/apollo')
  async fetchContactsApollo(
    @Req() req: Request & { workspaceId?: string },
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
    return this.fetchContactsForProvider('apollo', req, body);
  }

  /**
   * Helper method to check availability for a specific provider.
   */
  private async checkAvailabilityForProvider(
    providerName: 'arxena' | 'pdl' | 'contactout' | 'lusha' | 'apollo',
    linkedinUrl?: string,
    body?: { linkedinUrl?: string; linkedinUrls?: string[] },
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

    // Get the provider
    const provider = this.getProvider(providerName);
    if (!provider || !provider.isEnabled()) {
      throw new Error(`Provider ${providerName} is not enabled`);
    }

    // Check if we should process async
    if (this.jobService.shouldProcessAsync(urls.length)) {
      const jobId = await this.jobService.queueBulkJob(
        urls,
        'availability',
        undefined,
        providerName,
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
        results[url] = await provider.checkAvailability(url);
        // Add provider name to result
        if (results[url]) {
          results[url].provider = providerName;
        }
      } catch (error) {
        this.logger.error(`Availability check failed for ${url} using ${providerName}`, error as Error);
        results[url] = {
          emailAvailable: false,
          phoneAvailable: false,
          provider: providerName,
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
   * Helper method to fetch contacts for a specific provider.
   */
  private async fetchContactsForProvider(
    providerName: 'arxena' | 'pdl' | 'contactout' | 'lusha' | 'apollo',
    req: Request & { workspaceId?: string },
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

    // Get the provider
    const provider = this.getProvider(providerName);
    if (!provider || !provider.isEnabled()) {
      throw new Error(`Provider ${providerName} is not enabled`);
    }

    const options: ContactEnrichmentOptions = {
      wantEmail: body.wantEmail,
      wantPhone: body.wantPhone,
    };

    const wantEmail = options.wantEmail !== false;
    const wantPhone = options.wantPhone !== false;
    const workspaceId = req.workspaceId;

    if (
      process.env.IS_BILLING_ENABLED === 'true' &&
      workspaceId &&
      (wantEmail || wantPhone)
    ) {
      const totalEmailCredits = wantEmail ? urls.length : 0;
      const totalPhoneCredits = wantPhone ? urls.length : 0;
      const hasSufficient =
        await this.workspaceCreditsService.hasSufficientContactCreditsForCount(
          workspaceId,
          totalEmailCredits,
          totalPhoneCredits,
        );
      if (!hasSufficient) {
        throw new HttpException(
          'Insufficient contact credits',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // Check if we should process async
    if (this.jobService.shouldProcessAsync(urls.length)) {
      const jobId = await this.jobService.queueBulkJob(
        urls,
        'fetch',
        options,
        providerName,
        workspaceId,
      );
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
        if (
          process.env.IS_BILLING_ENABLED === 'true' &&
          workspaceId &&
          (wantEmail || wantPhone)
        ) {
          await this.workspaceCreditsService.debitContactCredits(
            workspaceId,
            wantEmail ? 1 : 0,
            wantPhone ? 1 : 0,
            { linkedinUrl: url, source: 'contact_enrichment' },
          );
        }

        results[url] = await provider.fetchContacts(url, options);
        // Ensure source includes provider name
        if (results[url]) {
          results[url].source = providerName;
        }
      } catch (error) {
        this.logger.error(`Fetch failed for ${url} using ${providerName}`, error as Error);
        results[url] = {
          emails: [],
          phones: [],
          source: providerName,
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
   * Get provider by name.
   */
  private getProvider(
    providerName: 'arxena' | 'pdl' | 'contactout' | 'lusha' | 'apollo',
  ) {
    switch (providerName) {
      case 'arxena':
        return this.arxenaProvider;
      case 'pdl':
        return this.pdlProvider;
      case 'contactout':
        return this.contactOutProvider;
      case 'lusha':
        return this.lushaProvider;
      case 'apollo':
        return this.apolloProvider;
      default:
        return null;
    }
  }
}
