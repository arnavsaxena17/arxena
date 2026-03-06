import { Inject, Logger } from '@nestjs/common';

import { WorkspaceCreditsService } from 'src/engine/core-modules/billing/services/workspace-credits.service';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';

import { ApolloProvider } from '../providers/apollo.provider';
import { ArxenaProvider } from '../providers/arxena.provider';
import { ContactOutProvider } from '../providers/contactout.provider';
import { LushaProvider } from '../providers/lusha.provider';
import { PdlProvider } from '../providers/pdl.provider';
import { ContactEnrichmentWaterfallService } from '../services/contact-enrichment-waterfall.service';
import type {
  ContactAvailability,
  ContactEnrichmentJobProgress,
  ContactEnrichmentOptions,
  ContactEnrichmentProviderName,
  ContactResult
} from '../types/contact-enrichment.types';

export type ContactEnrichmentJobData = {
  jobId: string;
  linkedinUrls: string[];
  operation: 'availability' | 'fetch';
  options?: ContactEnrichmentOptions;
  providerName?: ContactEnrichmentProviderName;
  workspaceId?: string;
};

@Processor(MessageQueue.contactEnrichmentQueue)
export class ContactEnrichmentQueueProcessor {
  private readonly logger = new Logger(ContactEnrichmentQueueProcessor.name);

  constructor(
    private readonly waterfallService: ContactEnrichmentWaterfallService,
    private readonly workspaceCreditsService: WorkspaceCreditsService,
    private readonly arxenaProvider: ArxenaProvider,
    private readonly pdlProvider: PdlProvider,
    private readonly contactOutProvider: ContactOutProvider,
    private readonly lushaProvider: LushaProvider,
    private readonly apolloProvider: ApolloProvider,
    @Inject(CacheStorageNamespace.EngineContactEnrichment)
    private readonly cacheStorage: CacheStorageService,
  ) {
    this.logger.log('ContactEnrichmentQueueProcessor initialized');
  }

  @Process(ContactEnrichmentQueueProcessor.name)
  async handle(jobData: ContactEnrichmentJobData): Promise<void> {
    const { jobId, linkedinUrls, operation, options, providerName, workspaceId } =
      jobData;

    this.logger.log(
      `Processing contact enrichment job ${jobId}: ${operation} for ${linkedinUrls.length} URLs${providerName ? ` using ${providerName} provider` : ' using waterfall'}`,
    );

    // Initialize progress
    const progress: ContactEnrichmentJobProgress = {
      jobId,
      status: 'running',
      total: linkedinUrls.length,
      completed: 0,
      failed: 0,
      results: {},
    };

    await this.updateProgress(jobId, progress);

    // Get provider if specified
    const provider = providerName ? this.getProvider(providerName) : null;

    const wantEmail = options?.wantEmail !== false;
    const wantPhone = options?.wantPhone !== false;

    // Process each URL sequentially (rate limiting is handled by waterfall service or provider)
    for (const linkedinUrl of linkedinUrls) {
      try {
        if (
          operation === 'fetch' &&
          process.env.IS_BILLING_ENABLED === 'true' &&
          workspaceId &&
          (wantEmail || wantPhone)
        ) {
          const hasSufficient =
            await this.workspaceCreditsService.hasSufficientContactCredits(
              workspaceId,
              wantEmail,
              wantPhone,
            );
          if (!hasSufficient) {
            throw new Error('Insufficient contact credits');
          }
          await this.workspaceCreditsService.debitContactCredits(
            workspaceId,
            wantEmail ? 1 : 0,
            wantPhone ? 1 : 0,
            { linkedinUrl, source: 'contact_enrichment_job' },
          );
        }

        let result: ContactAvailability | ContactResult;

        if (provider) {
          // Use specific provider
          if (operation === 'availability') {
            result = await provider.checkAvailability(linkedinUrl);
            if (result) {
              (result as ContactAvailability).provider = providerName;
            }
          } else {
            result = await provider.fetchContacts(linkedinUrl, options);
            if (result) {
              (result as ContactResult).source = providerName!;
            }
          }
        } else {
          // Use waterfall
          if (operation === 'availability') {
            result = await this.waterfallService.checkAvailability(linkedinUrl);
          } else {
            result = await this.waterfallService.fetchContacts(linkedinUrl, options);
          }
        }

        progress.results = progress.results ?? {};
        progress.results[linkedinUrl] = result;
        progress.completed += 1;
      } catch (error) {
        this.logger.error(
          `Failed to process ${linkedinUrl} in job ${jobId}`,
          error as Error,
        );
        progress.failed += 1;
        progress.results = progress.results ?? {};
        if (operation === 'availability') {
          progress.results[linkedinUrl] = {
            emailAvailable: false,
            phoneAvailable: false,
            provider: providerName,
          } as ContactAvailability;
        } else {
          progress.results[linkedinUrl] = {
            emails: [],
            phones: [],
            source: providerName || 'error',
          } as ContactResult;
        }
      }

      // Update progress after each URL
      await this.updateProgress(jobId, progress);
    }

    // Mark as completed
    progress.status = 'completed';
    await this.updateProgress(jobId, progress);

    this.logger.log(
      `Completed contact enrichment job ${jobId}: ${progress.completed} succeeded, ${progress.failed} failed`,
    );
  }

  /**
   * Get provider by name.
   */
  private getProvider(providerName: ContactEnrichmentProviderName) {
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

  private async updateProgress(
    jobId: string,
    progress: ContactEnrichmentJobProgress,
  ): Promise<void> {
    const key = `job:${jobId}`;
    await this.cacheStorage.set(key, progress, 24 * 60 * 60 * 1000); // 24 hour TTL
  }
}
