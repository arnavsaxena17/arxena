import { Process } from 'src/engine/integrations/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/integrations/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/integrations/message-queue/message-queue.constants';
import { EmailSenderService } from 'src/engine/integrations/email/email-sender.service';
import { SendMailOptions } from 'nodemailer';

@Processor(MessageQueue.candidateQueue)
export class CandidateQueueProcessor {
  constructor(
    private readonly emailSenderService: EmailSenderService,
  ) {
    console.log('CandidateQueueProcessor initialized');
  }

  @Process(CandidateQueueProcessor.name) // Use a specific name for this job type
  async handle(data: SendMailOptions): Promise<void> {
    console.log('CandidateQueueProcessor handling job:', data);
    try {
      const result = await this.emailSenderService.send(data);
      console.log('Candidate email sent successfully:', result);
    } catch (error) {
      console.error('Candidate email job failed:', error);
      throw error;
    }
  }
}