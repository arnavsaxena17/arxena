import { ProcessCandidatesJobData } from 'twenty-shared';

import { CandidateService } from 'src/engine/core-modules/candidate-sourcing/services/candidate.service';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';

@Processor(MessageQueue.candidateQueue)
export class CandidateQueueProcessor {
  constructor(private readonly candidateService: CandidateService) {
    console.log('CandidateQueueProcessor initialized');
  }

  @Process(CandidateQueueProcessor.name)
  async handle(jobData: ProcessCandidatesJobData): Promise<void> {
    // console.log('job.data.jobName::', jobData?.jobName);
    // console.log('job.data.jobName::', JSON.stringify(jobData));

    const batchInfo = jobData?.batchName?.includes('Batch')
      ? jobData.batchName.match(/Batch (\d+)\/(\d+)/)
      : null;

    console.log('batchInfo::', batchInfo);
    const batchNumber = batchInfo ? parseInt(batchInfo[1]) : 0;
    const totalBatches = batchInfo ? parseInt(batchInfo[2]) : '?';

    console.log(
      `Processing batch ${batchNumber}/${totalBatches} with ${jobData.data.length} candidates`,
    );
    try {
      console.log(
        'Reveived in CandidateQueueProcessor_batch process chunk ::',
        jobData.data.map((c) => c.unique_key_string),
      );

      await this.candidateService.processChunk(
        jobData.data,
        jobData.jobId,
        jobData.jobName,
        jobData.timestamp,
        jobData.apiToken,
        batchNumber,
        totalBatches,
      );
      console.log(
        `Successfully processed batch ${batchNumber}/${totalBatches}`,
      );
    } catch (error) {
      console.error(
        `Batch ${batchNumber}/${totalBatches} processing failed:`,
        error,
      );
      throw error;
    }
  }

  // @Process(CandidateQueueProcessor.name) // Use a specific name for this job type
  // async handle(jobCandidateData:ProcessCandidatesJobData): Promise<void> {
  //   console.log('CandidateQueueProcessor handling job. Processing. Number of candidates to be processed:', jobCandidateData.data.length);
  //   try {
  //     const { data, jobId, jobName, timestamp, apiToken, } = jobCandidateData;
  //     console.log('Processing candidate data. NUumber of profiles are:', data.length);
  //     const result = await this.candidateService.processProfilesWithRateLimiting(data, jobId, jobName, timestamp, apiToken);
  //     console.log('Candidates processing handled successfully:');
  //   } catch (error) {
  //     console.error('Candidate processing job failed:', error);
  //     throw error;
  //   }
  // }

  // @Process(CandidateQueueProcessor.name)
  // async handle(jobData: ProcessCandidatesJobData): Promise<void> {
  //   console.log('CandidateQueueProcessor handling job. Processing. Number of candidates to be processed:', jobData.data.length);

  //   try {
  //     // If the data batch is too large, process it in smaller chunks
  //     if (jobData.data.length > 10) {
  //       console.log(`Breaking large batch of ${jobData.data.length} candidates into smaller chunks`);
  //       await this.candidateService.processBatchedCandidates(jobData);
  //     } else {
  //       // For smaller batches, process normally
  //       console.log('Processing candidate data. Number of profiles are:', jobData.data.length);
  //       await this.candidateService.processProfilesWithRateLimiting(
  //         jobData.data, jobData.jobId, jobData.jobName, jobData.timestamp, jobData.apiToken
  //       );
  //     }

  //     console.log('Candidates processing handled successfully');
  //   } catch (error) {
  //     console.error('Candidate processing job failed:', error);
  //     throw error;
  //   }
  // }
}
