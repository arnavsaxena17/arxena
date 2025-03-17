// import { ProcessCandidatesJob } from '../jobs/process-candidates.job';
import { ProcessCandidatesJobData, UserProfile } from 'twenty-shared';

import { QueueCronJobOptions } from 'src/engine/core-modules/message-queue/drivers/interfaces/job-options.interface';

import { CandidateQueueProcessor } from 'src/engine/core-modules/candidate-sourcing/jobs/process-candidates.job';
import { CandidateService } from 'src/engine/core-modules/candidate-sourcing/services/candidate.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';

export class ProcessCandidatesService {
  constructor(
    @InjectMessageQueue(MessageQueue.candidateQueue)
    private readonly messageQueueService: MessageQueueService,
    private readonly candidateService: CandidateService,
  ) {}

  async send(
    data: UserProfile[],
    jobId: string,
    jobName: string,
    timestamp: string,
    apiToken: string,
  ): Promise<void> {
    try {
      console.log(`Queueing ${data.length} candidates for processing`);

      const batchSize = 30;
      const uniqueKeyToProfileMap = new Map<string, UserProfile>();

      // Skip candidates with empty unique_key_string
      data.forEach((candidate) => {
        if (
          candidate &&
          candidate.unique_key_string &&
          candidate.unique_key_string !== ''
        ) {
          uniqueKeyToProfileMap.set(candidate.unique_key_string, candidate);
        }
      });

      const deduplicatedProfiles = Array.from(uniqueKeyToProfileMap.values());

      const uniqueCandidates = new Set();

      for (const candidate of data) {
        uniqueCandidates.add(candidate.unique_key_string);
      }
      console.log(`Found ${uniqueCandidates.size} unique candidates`);

      // const deduplicatedProfiles = Array.from(uniqueCandidates);
      // console.log(`Deduplicated ${data.length} candidates to ${deduplicatedProfiles.length} unique profiles`);

      console.log(
        `Deduplicated ${data.length} candidates to ${deduplicatedProfiles.length} unique profiles`,
      );

      const totalBatches = Math.ceil(deduplicatedProfiles.length / batchSize);

      console.log(
        `Breaking up ${deduplicatedProfiles.length} candidates into ${totalBatches} batches of ~${batchSize} each`,
      );

      // Populate the map with the latest profile for each unique key

      // Convert the map values back to an array of UserProfile objects
      for (let i = 0; i < deduplicatedProfiles.length; i += batchSize) {
        const batch = deduplicatedProfiles.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;

        console.log(
          `Queueing batch ${batchNumber}/${totalBatches} with ${batch.length} candidates`,
        );
        const queueJobOptions: QueueCronJobOptions = {
          retryLimit: 3,
          priority: 1,
          repeat: { every: 1000 },
        };

        const batchName = `Batch ${batchNumber}/${totalBatches}`;

        console.log('This isthe processor batch name', batchName);
        console.log(
          'Batch number : ',
          batchNumber,
          'has ',
          batch.length,
          'candidates',
          'with unique keys of : ',
          batch.map((c) => c.unique_key_string),
        );
        const jobData: ProcessCandidatesJobData = {
          data: batch,
          jobId,
          jobName,
          batchName: batchName,
          timestamp,
          apiToken,
        };

        await this.messageQueueService.add<ProcessCandidatesJobData>(
          CandidateQueueProcessor.name,
          jobData,
          queueJobOptions,
        );
      }
      console.log(`Successfully queued ${totalBatches} batches of candidates`);
    } catch (error) {
      console.log('Failed to queue candidate processing:', error);
      throw error;
    }
  }
}
