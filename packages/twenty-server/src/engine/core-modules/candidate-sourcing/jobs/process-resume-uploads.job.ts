import { Injectable, Logger } from '@nestjs/common';
import { ProcessResumeUploadsJobData } from 'twenty-shared';

import { ResumeReadParseUploadService } from 'src/engine/core-modules/candidate-sourcing/services/resume-read-parse-upload.service';
import { UploadProgressPubSubService } from 'src/engine/core-modules/candidate-sourcing/services/upload-progress-pubsub.service';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';

@Injectable()
@Processor(MessageQueue.resumeUploadQueue)
export class ResumeUploadQueueProcessor {
  private readonly logger = new Logger(ResumeUploadQueueProcessor.name);

  constructor(
    private readonly resumeReadParseUploadService: ResumeReadParseUploadService,
    private readonly uploadProgressPubSubService: UploadProgressPubSubService,
  ) {}
  
  @Process(ResumeUploadQueueProcessor.name)
  async handle(jobData: ProcessResumeUploadsJobData): Promise<void> {
    this.logger.log(`Processing resume upload job: ${jobData.jobId} with ${jobData.filePaths.length} files`);
    this.logger.log(`Resume upload job - API token length: ${jobData.apiToken?.length}`);
    this.logger.log(`Resume upload job - API token preview: ${jobData.apiToken?.substring(0, 50)}...`);

    try {
      // Publish progress update - started
      if (jobData.userId) {
        try {
          await this.uploadProgressPubSubService.publishUploadStarted(
            jobData.userId,
            jobData.filePaths.length,
            Math.ceil(jobData.filePaths.length / 10) // Calculate batches (assuming 10 files per batch)
          );
        } catch (progressError) {
          this.logger.warn('Failed to publish upload started:', progressError.message);
        }
      }

      // Process the resume files
      const result = await this.resumeReadParseUploadService.processResumeFiles(
        jobData.filePaths,
        jobData.jobId,
        jobData.jobName,
        jobData.userId,
        jobData.origin,
        jobData.apiToken,
      );

      this.logger.log(`Resume upload processing completed: ${result.processedCount} processed, ${result.errorCount} errors`);

      // Publish completion notification
      if (jobData.userId) {
        try {
          if (result.success) {
            await this.uploadProgressPubSubService.publishUploadCompleted(
              jobData.userId,
              result.processedCount,
              jobData.filePaths.length
            );
          } else {
            await this.uploadProgressPubSubService.publishUploadError(
              jobData.userId,
              result.errors.join('; ') || 'Unknown error occurred'
            );
          }
        } catch (progressError) {
          this.logger.warn('Failed to publish upload completion:', progressError.message);
        }
      }

    } catch (error) {
      this.logger.error(`Resume upload processing failed:`, error);
      
      // Publish error notification
      if (jobData.userId) {
        try {
          await this.uploadProgressPubSubService.publishUploadError(
            jobData.userId,
            error.message || 'Unknown error occurred'
          );
        } catch (progressError) {
          this.logger.warn('Failed to publish upload error:', progressError.message);
        }
      }
      
      throw error;
    }
  }
}
