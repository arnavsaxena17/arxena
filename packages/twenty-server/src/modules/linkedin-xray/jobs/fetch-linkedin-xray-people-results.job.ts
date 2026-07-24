import { Injectable, Logger } from '@nestjs/common';

import { BrightDataLinkedinPeopleSearchService } from 'src/engine/core-modules/bright-data/services/bright-data-linkedin-people-search.service';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { LinkedinXrayProgressPubSubService } from 'src/modules/linkedin-xray/services/linkedin-xray-progress-pubsub.service';
import {
  LinkedinXrayPeopleResultsJobData,
  LinkedinXraySearchEngine,
} from 'src/modules/linkedin-xray/types/linkedin-xray-search-job.types';

@Injectable()
@Processor(MessageQueue.googleSearchPeopleResultsQueue)
export class LinkedinXrayPeopleResultsQueueProcessor {
  private readonly logger = new Logger(LinkedinXrayPeopleResultsQueueProcessor.name);

  constructor(
    private readonly brightDataLinkedinPeopleSearchService: BrightDataLinkedinPeopleSearchService,
    private readonly linkedinXrayProgressPubSubService: LinkedinXrayProgressPubSubService,
  ) {}

  @Process(LinkedinXrayPeopleResultsQueueProcessor.name)
  async handle(jobData: LinkedinXrayPeopleResultsJobData): Promise<void> {
    const pagesByEngine: Record<string, number[]> = {};

    try {
      await this.linkedinXrayProgressPubSubService.publishStarted({
        recruiterId: jobData.recruiterId,
        search_job_id: jobData.searchJobId,
        raw_query: jobData.rawQuery,
        search_engine: jobData.searchEngine,
        job_id: jobData.jobId,
        job_name: jobData.jobName,
        pagination_mode: jobData.paginationMode,
      });

      const engines = this.resolveEngines(jobData.searchEngine);

      const results =
        await this.brightDataLinkedinPeopleSearchService.fetchAllPeopleResults({
          engines,
          urls: jobData.urls,
          keywords: {
            google: [jobData.query.q, jobData.query.asOq].filter(Boolean).join(' ').trim(),
            bing: [jobData.query.q, jobData.query.asOq].filter(Boolean).join(' ').trim(),
          },
          includePaginatedHtml: jobData.includePaginatedHtml,
          dedupeByLinkedinUrl: true,
          onStatus: async (update) => {
            await this.linkedinXrayProgressPubSubService.publishStatus({
              recruiterId: jobData.recruiterId,
              search_job_id: jobData.searchJobId,
              raw_query: jobData.rawQuery,
              search_engine: jobData.searchEngine,
              engine: update.engine,
              message: update.message,
              job_id: jobData.jobId,
              job_name: jobData.jobName,
              snapshot_id: update.snapshotId,
              polling_attempt: update.pollingAttempt,
              pagination_mode: jobData.paginationMode,
            });
          },
          onPageFetched: async (update) => {
            pagesByEngine[update.engine] = update.fetchedPages;

            await this.linkedinXrayProgressPubSubService.publishPageFetched({
              recruiterId: jobData.recruiterId,
              search_job_id: jobData.searchJobId,
              raw_query: jobData.rawQuery,
              search_engine: jobData.searchEngine,
              engine: update.engine,
              message: `Fetched ${update.engine} page ${update.page}`,
              current_batch: update.page,
              total_batches: update.totalPagesAvailable,
              total_candidates: update.totalUniqueResults,
              processed_candidates: update.totalUniqueResults,
              fetched_pages: update.fetchedPages,
              page: update.page,
              pages_by_engine: { ...pagesByEngine },
              candidates: update.candidates,
              total_pages_available: update.totalPagesAvailable,
              job_id: jobData.jobId,
              job_name: jobData.jobName,
              pagination_mode: jobData.paginationMode,
            });
          },
        });

      await this.linkedinXrayProgressPubSubService.publishCompleted({
        recruiterId: jobData.recruiterId,
        search_job_id: jobData.searchJobId,
        raw_query: jobData.rawQuery,
        search_engine: jobData.searchEngine,
        current_batch: results.candidates.length,
        total_candidates: results.candidates.length,
        processed_candidates: results.candidates.length,
        pages_by_engine:
          results.engines.reduce<Record<string, number[]>>((acc, item) => {
            acc[item.engine] = item.pagesFetched;
            return acc;
          }, {}),
        candidates: results.candidates,
        job_id: jobData.jobId,
        job_name: jobData.jobName,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `LinkedIn x-ray people results job ${jobData.searchJobId} failed: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      await this.linkedinXrayProgressPubSubService.publishError(
        {
          recruiterId: jobData.recruiterId,
          search_job_id: jobData.searchJobId,
          raw_query: jobData.rawQuery,
          search_engine: jobData.searchEngine,
        },
        `LinkedIn x-ray people fetch failed: ${message}`,
      );

      throw error;
    }
  }

  private resolveEngines(
    searchEngine: LinkedinXraySearchEngine,
  ): Array<'google' | 'bing'> {
    if (searchEngine === 'both') {
      return ['google', 'bing'];
    }

    return [searchEngine];
  }
}
