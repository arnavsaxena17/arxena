import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';

export interface EnrichmentProgressData {
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
export class EnrichmentProgressPubSubService implements OnModuleDestroy {
  private readonly logger = new Logger(EnrichmentProgressPubSubService.name);
  private readonly CHANNEL_PREFIX = 'enrichment_progress:';
  private readonly messageHandlers = new Map<string, (progressData: EnrichmentProgressData) => void>();
  private subscriberClient: any = null;

  constructor(private readonly redisClientService: RedisClientService) {
    // Set up a separate subscriber client for Redis pub-sub
    this.setupSubscriberClient();
  }

  private setupSubscriberClient() {
    // Create a separate Redis client for subscriptions to avoid conflicts
    const redisUrl = this.redisClientService.getClient().options.host + ':' + this.redisClientService.getClient().options.port;
    const Redis = require('ioredis');
    
    this.subscriberClient = new Redis({
      host: this.redisClientService.getClient().options.host,
      port: this.redisClientService.getClient().options.port,
      password: this.redisClientService.getClient().options.password,
      maxRetriesPerRequest: null,
    });
    
    this.subscriberClient.on('message', (receivedChannel: string, message: string) => {
      try {
        console.log(`📨 [EnrichmentProgressPubSub] Received message on channel: ${receivedChannel}`);
        console.log(`📨 [EnrichmentProgressPubSub] Message content:`, message);
        const progressData: EnrichmentProgressData = JSON.parse(message);
        const handler = this.messageHandlers.get(receivedChannel);
        console.log(`📨 [EnrichmentProgressPubSub] Handler found for channel ${receivedChannel}:`, !!handler);
        if (handler) {
          console.log(`📨 [EnrichmentProgressPubSub] Calling handler with data:`, progressData);
          handler(progressData);
        } else {
          console.warn(`⚠️ [EnrichmentProgressPubSub] No handler found for channel: ${receivedChannel}`);
        }
      } catch (parseError) {
        console.error('❌ [EnrichmentProgressPubSub] Failed to parse progress message:', parseError);
        this.logger.error('Failed to parse progress message:', parseError);
      }
    });
  }

  /**
   * Publish enrichment progress update to Redis
   */
  async publishProgress(progressData: EnrichmentProgressData): Promise<void> {
    try {
      const channel = `${this.CHANNEL_PREFIX}${progressData.recruiterId}`;
      const message = JSON.stringify(progressData);
      
      console.log(`[EnrichmentProgressPubSub] Publishing to channel: ${channel}`);
      console.log(`[EnrichmentProgressPubSub] Message:`, progressData);
      
      const client = this.redisClientService.getClient();
      const result = await client.publish(channel, message);
      
      console.log(`[EnrichmentProgressPubSub] Published successfully. Subscribers notified: ${result}`);
      this.logger.debug(`Published progress update for recruiter ${progressData.recruiterId}: ${progressData.step}`);
    } catch (error) {
      console.error('[EnrichmentProgressPubSub] Failed to publish progress update:', error);
      this.logger.error('Failed to publish progress update:', error);
      throw error;
    }
  }

  /**
   * Subscribe to enrichment progress updates for a specific recruiter
   */
  async subscribeToProgress(
    recruiterId: string, 
    callback: (progressData: EnrichmentProgressData) => void
  ): Promise<void> {
    try {
      const channel = `${this.CHANNEL_PREFIX}${recruiterId}`;
      
      console.log(`🔗 [EnrichmentProgressPubSub] Subscribing to channel: ${channel}`);
      console.log(`🔗 [EnrichmentProgressPubSub] Subscriber client status:`, this.subscriberClient?.status);
      
      // Store the callback for this channel
      this.messageHandlers.set(channel, callback);
      
      await this.subscriberClient.subscribe(channel);
      
      console.log(`✅ [EnrichmentProgressPubSub] Successfully subscribed to channel: ${channel}`);
      console.log(`✅ [EnrichmentProgressPubSub] Active subscriptions:`, this.messageHandlers.size);
      this.logger.log(`Subscribed to progress updates for recruiter ${recruiterId}`);
    } catch (error) {
      console.error(`❌ [EnrichmentProgressPubSub] Failed to subscribe to channel ${this.CHANNEL_PREFIX}${recruiterId}:`, error);
      this.logger.error('Failed to subscribe to progress updates:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from enrichment progress updates for a specific recruiter
   */
  async unsubscribeFromProgress(recruiterId: string): Promise<void> {
    try {
      const channel = `${this.CHANNEL_PREFIX}${recruiterId}`;
      
      // Remove the callback for this channel
      this.messageHandlers.delete(channel);
      
      await this.subscriberClient.unsubscribe(channel);
      this.logger.log(`Unsubscribed from progress updates for recruiter ${recruiterId}`);
    } catch (error) {
      this.logger.error('Failed to unsubscribe from progress updates:', error);
    }
  }

  /**
   * Publish enrichment started event
   */
  async publishEnrichmentStarted(
    recruiterId: string,
    totalEnrichments: number,
    totalRecords: number
  ): Promise<void> {
    await this.publishProgress({
      recruiterId,
      step: 'started',
      message: 'Enrichment processing started',
      progress_percentage: 0,
      total_records: totalRecords,
      processed_records: 0,
      total_enrichments: totalEnrichments,
      current_enrichment: 0,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Publish enrichment processing event
   */
  async publishEnrichmentProcessing(
    recruiterId: string,
    progress: number,
    current: number,
    total: number,
    totalEnrichments: number
  ): Promise<void> {
    await this.publishProgress({
      recruiterId,
      step: 'processing',
      message: `Processing enrichments: ${current}/${total}`,
      progress_percentage: progress,
      total_records: total,
      processed_records: current,
      total_enrichments: totalEnrichments,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Publish enrichment completed event
   */
  async publishEnrichmentCompleted(
    recruiterId: string,
    totalRecords: number,
    totalEnrichments: number
  ): Promise<void> {
    await this.publishProgress({
      recruiterId,
      step: 'completed',
      message: 'Enrichment processing completed successfully',
      progress_percentage: 100,
      total_records: totalRecords,
      processed_records: totalRecords,
      total_enrichments: totalEnrichments,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Publish enrichment error event
   */
  async publishEnrichmentError(
    recruiterId: string,
    errorMessage: string
  ): Promise<void> {
    await this.publishProgress({
      recruiterId,
      step: 'error',
      message: `Enrichment processing failed: ${errorMessage}`,
      progress_percentage: 0,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Cleanup method to close the subscriber client
   */
  async onModuleDestroy() {
    if (this.subscriberClient) {
      await this.subscriberClient.quit();
      this.subscriberClient = null;
    }
  }
}
