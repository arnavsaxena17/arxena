import { Inject, Logger } from '@nestjs/common';

import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { TheOrgService } from 'src/engine/core-modules/theorg/services/theorg.service';
import type {
  TheOrgAsyncJobProgress,
  TheOrgCompanyResponse,
} from 'src/engine/core-modules/theorg/types/theorg.types';

export type TheOrgCompanyEnrichmentJobData = {
  jobId: string;
  slug: string;
  workspaceId?: string;
};

@Processor(MessageQueue.theOrgQueue)
export class TheOrgCompanyEnrichmentJob {
  private readonly logger = new Logger(TheOrgCompanyEnrichmentJob.name);

  private get jobTtlMs(): number {
    return Number(process.env.THEORG_JOB_TTL_MS ?? 24 * 60 * 60 * 1000);
  }

  constructor(
    private readonly theOrgService: TheOrgService,
    @Inject(CacheStorageNamespace.EngineTheOrg)
    private readonly cacheStorage: CacheStorageService,
  ) {}

  @Process({ jobName: TheOrgCompanyEnrichmentJob.name, concurrency: 1 })
  async handle(jobData: TheOrgCompanyEnrichmentJobData): Promise<void> {
    const progress: TheOrgAsyncJobProgress = {
      jobId: jobData.jobId,
      slug: jobData.slug,
      workspaceId: jobData.workspaceId,
      status: 'running',
      total: 1,
      completed: 0,
      failed: 0,
    };

    await this.updateProgress(progress);

    try {
      const result = await this.theOrgService.fetchCompanyDetails(jobData.slug, {
        includePeopleProfiles: true,
        forceInlineProfiles: true,
        persist: true,
        storageTarget: {
          folderSegments: ['jobs'],
          filename: `${jobData.jobId}.json`,
        },
      });

      progress.status = 'completed';
      progress.completed = 1;
      progress.storage = result.storage;
      progress.result = {
        companyName: result.companyName,
        peopleCount: result.people.length,
        includePeopleProfiles: true,
      };

      await this.updateProgress(progress);

      this.logger.log(
        `Completed TheOrg enrichment job ${jobData.jobId} for ${jobData.slug}`,
      );
    } catch (error) {
      progress.status = 'failed';
      progress.failed = 1;
      progress.error =
        error instanceof Error ? error.message : 'TheOrg async enrichment failed';

      await this.updateProgress(progress);

      this.logger.error(
        `TheOrg enrichment job ${jobData.jobId} failed for ${jobData.slug}`,
        error as Error,
      );
    }
  }

  private async updateProgress(progress: TheOrgAsyncJobProgress): Promise<void> {
    await this.cacheStorage.set(
      `job:${progress.jobId}`,
      progress,
      this.jobTtlMs,
    );
  }
}
