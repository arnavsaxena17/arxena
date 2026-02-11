import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 } from 'uuid';

import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';

import type { ContactEnrichmentJobData } from '../jobs/process-contact-enrichment.job';
import { ContactEnrichmentQueueProcessor } from '../jobs/process-contact-enrichment.job';
import type {
  ContactEnrichmentJobProgress,
  ContactEnrichmentOptions,
} from '../types/contact-enrichment.types';

@Injectable()
export class ContactEnrichmentJobService {
  private readonly logger = new Logger(ContactEnrichmentJobService.name);
  private readonly bulkThreshold = 20; // Process async if more than this many URLs

  constructor(
    @InjectMessageQueue(MessageQueue.contactEnrichmentQueue)
    private readonly messageQueueService: MessageQueueService,
    @Inject(CacheStorageNamespace.EngineContactEnrichment)
    private readonly cacheStorage: CacheStorageService,
  ) {}

  /**
   * Get progress for a job.
   */
  async getJobProgress(
    jobId: string,
  ): Promise<ContactEnrichmentJobProgress | null> {
    try {
      const key = `job:${jobId}`;
      const progress = await this.cacheStorage.get<ContactEnrichmentJobProgress>(
        key,
      );
      return progress ?? null;
    } catch (error) {
      this.logger.error(`Failed to get job progress for ${jobId}`, error as Error);
      return null;
    }
  }

  /**
   * Queue a bulk contact enrichment job.
   */
  async queueBulkJob(
    linkedinUrls: string[],
    operation: 'availability' | 'fetch',
    options?: ContactEnrichmentOptions,
  ): Promise<string> {
    const jobId = v4();

    const jobData: ContactEnrichmentJobData = {
      jobId,
      linkedinUrls,
      operation,
      options,
    };

    await this.messageQueueService.add(
      ContactEnrichmentQueueProcessor.name,
      jobData,
    );

    this.logger.log(
      `Queued contact enrichment job ${jobId} for ${linkedinUrls.length} URLs`,
    );

    return jobId;
  }

  /**
   * Check if a request should be processed asynchronously.
   */
  shouldProcessAsync(linkedinUrlsCount: number): boolean {
    return linkedinUrlsCount > this.bulkThreshold;
  }
}
