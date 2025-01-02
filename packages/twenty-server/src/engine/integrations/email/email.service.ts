import { Injectable, Logger } from '@nestjs/common';

import { SendMailOptions } from 'nodemailer';

import { MessageQueue } from 'src/engine/integrations/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/integrations/message-queue/services/message-queue.service';
import { EmailSenderJob } from 'src/engine/integrations/email/email-sender.job';
import { InjectMessageQueue } from 'src/engine/integrations/message-queue/decorators/message-queue.decorator';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectMessageQueue(MessageQueue.systemEmailQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  async send(sendMailOptions: SendMailOptions): Promise<void> {
    
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
