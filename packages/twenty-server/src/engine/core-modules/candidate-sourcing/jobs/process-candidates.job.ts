import { SendMailOptions } from 'nodemailer';

import { EmailSenderService } from 'src/engine/integrations/email/email-sender.service';
import { MessageQueue } from 'src/engine/integrations/message-queue/message-queue.constants';
import { Processor } from 'src/engine/integrations/message-queue/decorators/processor.decorator';
import { Process } from 'src/engine/integrations/message-queue/decorators/process.decorator';
import { Logger } from '@nestjs/common';

@Processor(MessageQueue.emailQueue)
export class EmailSenderJob {
  constructor(
    private readonly emailSenderService: EmailSenderService,
    
  ) {}

  @Process(EmailSenderJob.name)
  async handle(data: SendMailOptions): Promise<void> {
    console.log("REceivd panda data:", data)
    console.log('Starting email job:', {
      to: data.to,
      subject: data.subject
    });
  
    try {
      const result = await this.emailSenderService.send(data);
      console.log('Email sent successfully:', result);
    } catch (error) {
      console.log('Email job failed:', error);
      // Re-throw to trigger retry mechanism
      throw error;
    }
  }
  
  
}
