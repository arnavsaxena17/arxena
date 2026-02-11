import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';

export interface AiFilteringProgressData {
  recruiterId: string;
  step: string;
  message: string;
  progress_percentage?: number;
  total_records?: number;
  processed_records?: number;
  current_enrichment?: number;
  total_enrichments?: number;
  timestamp: string;
}

@Injectable()
export class AiFilteringProgressPubSubService implements OnModuleDestroy {
  private readonly logger = new Logger(AiFilteringProgressPubSubService.name);
  private readonly CHANNEL_PREFIX = 'enrichment_progress:';
  private readonly messageHandlers = new Map<string, (progressData: AiFilteringProgressData) => void>();
  private subscriberClient: any = null;

  constructor(private readonly redisClientService: RedisClientService) {
    this.setupSubscriberClient();
  }

  private setupSubscriberClient() {
    const Redis = require('ioredis');

    this.subscriberClient = new Redis({
      host: this.redisClientService.getClient().options.host,
      port: this.redisClientService.getClient().options.port,
      password: this.redisClientService.getClient().options.password,
      maxRetriesPerRequest: null,
    });

    this.subscriberClient.on('message', (receivedChannel: string, message: string) => {
      try {
        const progressData: AiFilteringProgressData = JSON.parse(message);
        const handler = this.messageHandlers.get(receivedChannel);
        if (handler) {
          handler(progressData);
        }
      } catch (parseError) {
        this.logger.error('Failed to parse progress message:', parseError);
      }
    });
  }

  async publishProgress(progressData: AiFilteringProgressData): Promise<void> {
    try {
      const channel = `${this.CHANNEL_PREFIX}${progressData.recruiterId}`;
      const message = JSON.stringify(progressData);
      const client = this.redisClientService.getClient();
      await client.publish(channel, message);
      this.logger.debug(`Published progress update for recruiter ${progressData.recruiterId}: ${progressData.step}`);
    } catch (error) {
      this.logger.error('Failed to publish progress update:', error);
      throw error;
    }
  }

  async subscribeToProgress(
    recruiterId: string,
    callback: (progressData: AiFilteringProgressData) => void
  ): Promise<void> {
    try {
      const channel = `${this.CHANNEL_PREFIX}${recruiterId}`;
      this.messageHandlers.set(channel, callback);
      await this.subscriberClient.subscribe(channel);
      this.logger.log(`Subscribed to progress updates for recruiter ${recruiterId}`);
    } catch (error) {
      this.logger.error('Failed to subscribe to progress updates:', error);
      throw error;
    }
  }

  async unsubscribeFromProgress(recruiterId: string): Promise<void> {
    try {
      const channel = `${this.CHANNEL_PREFIX}${recruiterId}`;
      this.messageHandlers.delete(channel);
      await this.subscriberClient.unsubscribe(channel);
      this.logger.log(`Unsubscribed from progress updates for recruiter ${recruiterId}`);
    } catch (error) {
      this.logger.error('Failed to unsubscribe from progress updates:', error);
    }
  }

  async publishAiFilteringStarted(
    recruiterId: string,
    totalAiFilters: number,
    totalRecords: number
  ): Promise<void> {
    await this.publishProgress({
      recruiterId,
      step: 'started',
      message: 'AI filtering started',
      progress_percentage: 0,
      total_records: totalRecords,
      processed_records: 0,
      total_enrichments: totalAiFilters,
      current_enrichment: 0,
      timestamp: new Date().toISOString()
    });
  }

  async publishAiFilteringProcessing(
    recruiterId: string,
    progress: number,
    current: number,
    total: number,
    totalAiFilters: number
  ): Promise<void> {
    await this.publishProgress({
      recruiterId,
      step: 'processing',
      message: `Processing AI filters: ${current}/${total}`,
      progress_percentage: progress,
      total_records: total,
      processed_records: current,
      total_enrichments: totalAiFilters,
      timestamp: new Date().toISOString()
    });
  }

  async publishAiFilteringCompleted(
    recruiterId: string,
    totalRecords: number,
    totalAiFilters: number
  ): Promise<void> {
    await this.publishProgress({
      recruiterId,
      step: 'completed',
      message: 'AI filtering completed successfully',
      progress_percentage: 100,
      total_records: totalRecords,
      processed_records: totalRecords,
      total_enrichments: totalAiFilters,
      timestamp: new Date().toISOString()
    });
  }

  async publishAiFilteringError(
    recruiterId: string,
    errorMessage: string
  ): Promise<void> {
    await this.publishProgress({
      recruiterId,
      step: 'error',
      message: `AI filtering failed: ${errorMessage}`,
      progress_percentage: 0,
      timestamp: new Date().toISOString()
    });
  }

  async onModuleDestroy() {
    if (this.subscriberClient) {
      await this.subscriberClient.quit();
      this.subscriberClient = null;
    }
  }
}
