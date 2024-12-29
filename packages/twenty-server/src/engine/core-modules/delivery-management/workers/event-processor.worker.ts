import { Injectable, Logger } from '@nestjs/common';
import { InjectMessageQueue } from 'src/engine/integrations/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/integrations/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/integrations/message-queue/services/message-queue.service';
import { EventProcessorJob } from '../jobs/event-processor.job';
import * as deliveryManagementTypes from '../types/delivery-management.types';

@Injectable()
export class EventProcessorWorker {
  private readonly logger = new Logger(EventProcessorWorker.name);

  constructor(
    @InjectMessageQueue(MessageQueue.eventProcessingQueue)
    private readonly messageQueueService: MessageQueueService,
    private readonly eventProcessorJob: EventProcessorJob,
  ) {
    this.initialize();
  }

  private initialize() {
    this.messageQueueService.work<deliveryManagementTypes.RecruitmentEvent>(
      async (job) => {
        this.logger.debug(`Processing event ${job.data.id}`);
        await this.eventProcessorJob.handle(job.data);
      },
      {
        concurrency: 5, // Process 5 jobs concurrently
      }
    );
  }
}
