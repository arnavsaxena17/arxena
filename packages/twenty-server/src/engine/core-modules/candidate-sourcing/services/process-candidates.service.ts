import * as CandidateSourcingTypes from '../types/candidate-sourcing-types';
// import { ProcessCandidatesJob } from '../jobs/process-candidates.job';
import { MessageQueue } from 'src/engine/integrations/message-queue/message-queue.constants';
import { InjectMessageQueue } from 'src/engine/integrations/message-queue/decorators/message-queue.decorator';
import { MessageQueueService } from 'src/engine/integrations/message-queue/services/message-queue.service';
import { SendMailOptions } from 'nodemailer';
import { CandidateQueueProcessor } from '../jobs/process-candidates.job';

export class ProcessCandidatesService {
  constructor(
    @InjectMessageQueue(MessageQueue.candidateQueue)
    private readonly messageQueueService: MessageQueueService,
) {}
  async send(data: CandidateSourcingTypes.UserProfile[], sendMailOptions: SendMailOptions, jobName: any, timestamp: any, apiToken: any): Promise<void> {
    try {
      // console.log("data:", data)
      console.log('Queueing candidate email:', sendMailOptions);
      await this.messageQueueService.add<SendMailOptions>(
        'processCandidate', // Match the name in the @Process decorator
        sendMailOptions,
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


