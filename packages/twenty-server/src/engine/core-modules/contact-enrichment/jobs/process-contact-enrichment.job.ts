import { Inject, Logger } from '@nestjs/common';

import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';

import { ContactEnrichmentWaterfallService } from '../services/contact-enrichment-waterfall.service';
import type {
  ContactAvailability,
  ContactEnrichmentJobProgress,
  ContactEnrichmentOptions,
  ContactResult
} from '../types/contact-enrichment.types';

export type ContactEnrichmentJobData = {
  jobId: string;
  linkedinUrls: string[];
  operation: 'availability' | 'fetch';
  options?: ContactEnrichmentOptions;
};

@Processor(MessageQueue.contactEnrichmentQueue)
export class ContactEnrichmentQueueProcessor {
  private readonly logger = new Logger(ContactEnrichmentQueueProcessor.name);

  constructor(
    private readonly waterfallService: ContactEnrichmentWaterfallService,
    @Inject(CacheStorageNamespace.EngineContactEnrichment)
    private readonly cacheStorage: CacheStorageService,
  ) {
    this.logger.log('ContactEnrichmentQueueProcessor initialized');
  }

  @Process(ContactEnrichmentQueueProcessor.name)
  async handle(jobData: ContactEnrichmentJobData): Promise<void> {
    const { jobId, linkedinUrls, operation, options } = jobData;

    this.logger.log(
      `Processing contact enrichment job ${jobId}: ${operation} for ${linkedinUrls.length} URLs`,
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

    // Process each URL sequentially (rate limiting is handled by waterfall service)
    for (const linkedinUrl of linkedinUrls) {
      try {
        let result: ContactAvailability | ContactResult;

        if (operation === 'availability') {
          result = await this.waterfallService.checkAvailability(linkedinUrl);
        } else {
          result = await this.waterfallService.fetchContacts(linkedinUrl, options);
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
        progress.results[linkedinUrl] = {
          emails: [],
          phones: [],
          source: 'error',
        } as ContactResult;
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

  private async updateProgress(
    jobId: string,
    progress: ContactEnrichmentJobProgress,
  ): Promise<void> {
    const key = `job:${jobId}`;
    await this.cacheStorage.set(key, progress, 24 * 60 * 60 * 1000); // 24 hour TTL
  }
}
