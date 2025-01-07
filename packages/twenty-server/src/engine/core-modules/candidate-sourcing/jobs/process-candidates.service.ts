import * as CandidateSourcingTypes from '../types/candidate-sourcing-types';
// import { ProcessCandidatesJob } from '../jobs/process-candidates.job';
import { MessageQueue } from 'src/engine/integrations/message-queue/message-queue.constants';
import { InjectMessageQueue } from 'src/engine/integrations/message-queue/decorators/message-queue.decorator';
import { MessageQueueService } from 'src/engine/integrations/message-queue/services/message-queue.service';
import { CandidateQueueProcessor } from './process-candidates.job';
import { CandidateService } from '../services/candidate.service';

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
      const result = await this.candidateService.processProfilesWithRateLimiting(data, jobId, jobName, timestamp, apiToken);



      // await this.messageQueueService.add<CandidateSourcingTypes.ProcessCandidatesJobData>(
      //   CandidateQueueProcessor.name,
      //   { data, jobId, jobName, timestamp, apiToken, } ,
      //   { retryLimit: 3, },
      // );




    } catch (error) {
      console.log('Failed to queue candidate email:', error);
      throw error;
    }
  }
}