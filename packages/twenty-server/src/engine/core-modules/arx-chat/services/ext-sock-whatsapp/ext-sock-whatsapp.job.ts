import { WhatsappMessageJobData } from 'twenty-shared';

import { ExtSockWhatsappWhitelistProcessingService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whitelist-processing';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';

@Processor(MessageQueue.extSockWhatsappQueue)
export class WhatsappMessageProcessor {
  constructor(
    private readonly extSockWhatsappWhitelistProcessingService: ExtSockWhatsappWhitelistProcessingService,
  ) {
    console.log('WhatsappMessageProcessor initialized');
  }

  @Process(WhatsappMessageProcessor.name)
  async handle(jobData: WhatsappMessageJobData): Promise<void> {
    console.log(`Processing WhatsApp message: ${jobData.data.id}`);

    try {
      const phoneNumber = jobData.data.from;

      // Use the pre-built mapping to find userId
      const userId =
        await this.extSockWhatsappWhitelistProcessingService.redisService.getUserIdForPhoneNumber(
          phoneNumber,
        );

      if (!userId) {
        console.log(
          `No user found for phone number ${phoneNumber}, skipping message`,
        );

        return;
      }

      console.log(`Found userId ${userId} for phone number ${phoneNumber}`);

      await this.extSockWhatsappWhitelistProcessingService.processWhatsappMessage(
        userId,
        jobData.data,
      );

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
