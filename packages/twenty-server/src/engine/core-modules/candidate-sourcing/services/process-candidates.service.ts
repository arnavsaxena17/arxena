import * as CandidateSourcingTypes from '../types/candidate-sourcing-types';
// import { ProcessCandidatesJob } from '../jobs/process-candidates.job';
import { MessageQueue } from 'src/engine/integrations/message-queue/message-queue.constants';
import { InjectMessageQueue } from 'src/engine/integrations/message-queue/decorators/message-queue.decorator';
import { MessageQueueService } from 'src/engine/integrations/message-queue/services/message-queue.service';
import { SendMailOptions } from 'nodemailer';
import { EmailSenderJob } from '../jobs/process-candidates.job';

export class ProcessCandidatesService {
  constructor(
    @InjectMessageQueue(MessageQueue.emailQueue)
    private readonly messageQueueService: MessageQueueService,
) {}

    async send(data: CandidateSourcingTypes.UserProfile[], sendMailOptions: SendMailOptions, jobName: any, timestamp: any, apiToken: any): Promise<void> {
      
      try {
        console.log('Queueing email:', sendMailOptions);
        await this.messageQueueService.add<SendMailOptions>(
          EmailSenderJob.name,
          sendMailOptions,
          { 
            retryLimit: 3,
          },
        );
      } catch (error) {
        console.log('Failed to queue email:', error);
        throw error;
      }
    }
  
}