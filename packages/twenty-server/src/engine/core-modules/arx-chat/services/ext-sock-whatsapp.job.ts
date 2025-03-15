import { WhatsappMessageJobData } from 'twenty-shared';

import { processMessage } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp-process';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';

// import { ExtSockWhatsappService } from './ext-sock-whatsapp.service';

@Processor(MessageQueue.extSockWhatsappQueue)
export class WhatsappMessageProcessor {
  constructor() {
    console.log('WhatsappMessageProcessor initialized');
  }

  @Process(WhatsappMessageProcessor.name)
  async handle(jobData: WhatsappMessageJobData): Promise<void> {
    console.log(`Processing WhatsApp message: ${jobData.data.id}`);

    try {
      await processMessage(jobData.data);
      console.log(
        `WhatsApp message processed successfully: ${jobData.data.id}`,
      );
    } catch (error) {
      console.error(
        `WhatsApp message processing failed: ${jobData.data.id}`,
        error,
      );
      throw error;
    }
  }
}
