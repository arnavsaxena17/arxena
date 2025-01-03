import * as CandidateSourcingTypes from '../types/candidate-sourcing-types';
// import { ProcessCandidatesJob } from '../jobs/process-candidates.job';
import { MessageQueue } from 'src/engine/integrations/message-queue/message-queue.constants';
import { InjectMessageQueue } from 'src/engine/integrations/message-queue/decorators/message-queue.decorator';
import { MessageQueueService } from 'src/engine/integrations/message-queue/services/message-queue.service';
import { CandidateQueueProcessor } from './process-candidates.job';

export class ProcessCandidatesService {
  constructor(
    @InjectMessageQueue(MessageQueue.candidateQueue)
    private readonly messageQueueService: MessageQueueService,
) {}


  async send(data: CandidateSourcingTypes.UserProfile[],jobId:string, jobName: string, timestamp: string, apiToken: string): Promise<void> {
    try {
      console.log('Queueing candidate data:');
      await this.messageQueueService.add<CandidateSourcingTypes.ProcessCandidatesJobData>(
        CandidateQueueProcessor.name,
        {
          data,
          jobId,
          jobName,
          timestamp,
          apiToken,
        }
        ,
        { 
          retryLimit: 3,
        },
      );
    } catch (error) {
      console.log('Failed to queue candidate email:', error);
      throw error;
    }
  }

  
}


