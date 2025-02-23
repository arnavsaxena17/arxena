import * as CandidateSourcingTypes from '../types/candidate-sourcing-types';
// import { ProcessCandidatesJob } from '../jobs/process-candidates.job';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { QueueCronJobOptions } from 'src/engine/core-modules/message-queue/drivers/interfaces/job-options.interface';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { CandidateService } from '../services/candidate.service';
import { CandidateQueueProcessor } from './process-candidates.job';

export class ProcessCandidatesService {
  constructor(
  @InjectMessageQueue(MessageQueue.candidateQueue)
    private readonly messageQueueService: MessageQueueService,
    private readonly candidateService: CandidateService,
) {}


  async send(data: CandidateSourcingTypes.UserProfile[],jobId:string, jobName: string, timestamp: string, apiToken: string): Promise<void> {
    try {
      console.log('Queueing candidate data:');


      // const { data, jobId, jobName, timestamp, apiToken, } = jobCandidateData;
      // console.log('Processing candidate data. NUumber of profiles are:', data.length);
      // const result = await this.candidateService.processProfilesWithRateLimiting(data, jobId, jobName, timestamp, apiToken);

      const queueJobOptions: QueueCronJobOptions = {
        retryLimit: 3,
        priority: 1,
        repeat: { every: 1000 },
      };

      await this.messageQueueService.add<CandidateSourcingTypes.ProcessCandidatesJobData>(
        CandidateQueueProcessor.name,
        { data, jobId, jobName, timestamp, apiToken },
        queueJobOptions,
      );



    } catch (error) {
      console.log('Failed to queue candidate email:', error);
      throw error;
    }
  }
}