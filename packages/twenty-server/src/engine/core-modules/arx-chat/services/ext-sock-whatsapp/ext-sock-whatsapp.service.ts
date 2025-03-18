import { WhatsappMessageData, WhatsappMessageJobData } from 'twenty-shared';

import { QueueCronJobOptions } from 'src/engine/core-modules/message-queue/drivers/interfaces/job-options.interface';

import { WhatsappMessageProcessor } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp.job';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';

export class ExtSockWhatsappService {
  constructor(
    @InjectMessageQueue(MessageQueue.extSockWhatsappQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  async queueMessage(messageData: WhatsappMessageData): Promise<void> {
    try {
      console.log(
        `Queueing WhatsApp message for processing: ${messageData.id}`,
      );

      const queueJobOptions: QueueCronJobOptions = {
        retryLimit: 3,
        priority: 1,
        repeat: {
          every: 1000,
        },
      };

      const jobData: WhatsappMessageJobData = {
        data: messageData,
      };

      await this.messageQueueService.add<WhatsappMessageJobData>(
        WhatsappMessageProcessor.name,
        jobData,
        queueJobOptions,
      );

      console.log(`Successfully queued WhatsApp message: ${messageData.id}`);
    } catch (error) {
      console.error('Failed to queue WhatsApp message:', error);
      throw error;
    }
  }
}
