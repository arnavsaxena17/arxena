import { WhatsappMessageJobData, isDefined } from 'twenty-shared';

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
    console.log(`Processing message: ${jobData.data.id}`);

    try {
      // Determine the identifier based on message type
      let identifier: string;
      let messageType: string;

      if (isDefined(jobData?.data?.linkedin_url)) {
        identifier = jobData.data.linkedin_url;
        messageType = 'LinkedIn';
      } else {
        identifier = jobData.data.from;
        messageType = 'WhatsApp';
      }

      console.log(`Processing ${messageType} message: ${jobData.data.id}`);

      // Use the pre-built mapping to find userId
      const userId =
        await this.extSockWhatsappWhitelistProcessingService.redisService.getUserIdForIdentifier(
          identifier,
        );

      console.log('userId', userId);

      if (!userId) {
        console.log(
          `No user found for ${messageType} identifier ${identifier}, skipping message`,
        );

        return;
      }

      console.log(
        `Found userId ${userId} for ${messageType} identifier ${identifier}`,
      );

      await this.extSockWhatsappWhitelistProcessingService.processSockMessage(
        userId,
        jobData.data,
      );

      console.log(
        `${messageType} message processed successfully: ${jobData.data.id}`,
      );
    } catch (error) {
      console.error(`Message processing failed: ${jobData.data.id}`, error);
      throw error;
    }
  }
}
