import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventProcessingSystem } from '../services/event-processing-system';
import { PhaseTransitionManager } from '../managers/phase-change-transition-manager';
import { InjectMessageQueue } from 'src/engine/integrations/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/integrations/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/integrations/message-queue/services/message-queue.service';
import { EventProcessorJob } from '../jobs/event-processor.job';
import * as deliveryManagementTypes from '../types/delivery-management.types';
import { DateTime } from 'luxon';

@Injectable()
export class EventProcessingCron {
  private readonly logger = new Logger(EventProcessingCron.name);
  private readonly batchSize = 100; // Process events in batches
  private lastProcessedTimestamp: DateTime;

  constructor(
    private readonly eventProcessingSystem: EventProcessingSystem,
    private readonly phaseTransitionManager: PhaseTransitionManager,
    @InjectMessageQueue(MessageQueue.eventProcessingQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {
    this.lastProcessedTimestamp = DateTime.now();
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleEventProcessing() {
    try {
      this.logger.log('Starting event processing cron job');
      const currentTimestamp = DateTime.now();

      const recentEvents = Array.from(this.eventProcessingSystem.events.values())
        .filter(event => event.timestamp > this.lastProcessedTimestamp)
        .sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());

      // Process each event individually
      for (const event of recentEvents) {
        await this.queueEvent(event);
      }

      this.lastProcessedTimestamp = currentTimestamp;
      this.logger.log(`Queued ${recentEvents.length} events for processing`);
    } catch (error) {
      this.logger.error('Error in event processing cron job', error.stack);
    }
  }

  private async queueEvent(event: deliveryManagementTypes.RecruitmentEvent): Promise<void> {
    try {
      await this.messageQueueService.add<deliveryManagementTypes.RecruitmentEvent>(
        EventProcessorJob.jobName,
        event,
        {
          retryLimit: 3,
          // Use event ID for tracking if needed
          priority: 0,
        }
      );
      this.logger.debug(`Successfully queued event ${event.id} for processing`);
    } catch (error) {
      this.logger.error(`Failed to queue event ${event.id}`, error.stack);
    }
  }


}
