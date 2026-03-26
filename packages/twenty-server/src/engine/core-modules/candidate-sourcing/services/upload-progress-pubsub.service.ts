import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';

export interface UploadProgressData {
  recruiterId: string;
  step: string;
  message: string;
  progress_percentage?: number;
  total_candidates?: number;
  processed_candidates?: number;
  current_batch?: number;
  total_batches?: number;
  timestamp: string;
}

@Injectable()
export class UploadProgressPubSubService implements OnModuleDestroy {
  private readonly logger = new Logger(UploadProgressPubSubService.name);
  private readonly CHANNEL_PREFIX = 'upload_progress:';
  private readonly messageHandlers = new Map<string, (progressData: UploadProgressData) => void>();
  private subscriberClient: any = null;

  constructor(private readonly redisClientService: RedisClientService) {}

  /** Lazily create the Redis subscriber so idle processes do not hold an extra connection. */
  private ensureSubscriberClient() {
    if (this.subscriberClient) {
      return;
    }
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
        console.log(`📨 [UploadProgressPubSub] Received message on channel: ${receivedChannel}`);
        console.log(`📨 [UploadProgressPubSub] Message content:`, message);
        const progressData: UploadProgressData = JSON.parse(message);
        const handler = this.messageHandlers.get(receivedChannel);
        console.log(`📨 [UploadProgressPubSub] Handler found for channel ${receivedChannel}:`, !!handler);
        if (handler) {
          console.log(`📨 [UploadProgressPubSub] Calling handler with data:`, progressData);
          handler(progressData);
        } else {
          console.warn(`⚠️ [UploadProgressPubSub] No handler found for channel: ${receivedChannel}`);
        }
      } catch (parseError) {
        console.error('❌ [UploadProgressPubSub] Failed to parse progress message:', parseError);
        this.logger.error('Failed to parse progress message:', parseError);
      }
    });
  }

  /**
   * Publish upload progress update to Redis
   */
  async publishProgress(progressData: UploadProgressData): Promise<void> {
    try {
      const channel = `${this.CHANNEL_PREFIX}${progressData.recruiterId}`;
      const message = JSON.stringify(progressData);
      
      console.log(`[UploadProgressPubSub] Publishing to channel: ${channel}`);
      console.log(`[UploadProgressPubSub] Recruiter ID: ${progressData.recruiterId}`);
      console.log(`[UploadProgressPubSub] Message:`, progressData);
      
      const client = this.redisClientService.getClient();
      const result = await client.publish(channel, message);
      
      console.log(`[UploadProgressPubSub] Published successfully. Subscribers notified: ${result}`);
      this.logger.debug(`Published progress update for recruiter ${progressData.recruiterId}: ${progressData.step}`);
    } catch (error) {
      console.error('[UploadProgressPubSub] Failed to publish progress update:', error);
      this.logger.error('Failed to publish progress update:', error);
      throw error;
    }
  }

  /**
   * Subscribe to upload progress updates for a specific recruiter
   */
  async subscribeToProgress(
    recruiterId: string, 
    callback: (progressData: UploadProgressData) => void
  ): Promise<void> {
    this.ensureSubscriberClient();
    try {
      const channel = `${this.CHANNEL_PREFIX}${recruiterId}`;
      
      console.log(`🔗 [UploadProgressPubSub] Subscribing to channel: ${channel}`);
      console.log(`🔗 [UploadProgressPubSub] Recruiter ID: ${recruiterId}`);
      console.log(`🔗 [UploadProgressPubSub] Subscriber client status:`, this.subscriberClient?.status);
      
      // Store the callback for this channel
      this.messageHandlers.set(channel, callback);
      
      await this.subscriberClient.subscribe(channel);
      
      console.log(`✅ [UploadProgressPubSub] Successfully subscribed to channel: ${channel}`);
      console.log(`✅ [UploadProgressPubSub] Active subscriptions:`, this.messageHandlers.size);
      this.logger.log(`Subscribed to progress updates for recruiter ${recruiterId}`);
    } catch (error) {
      console.error(`❌ [UploadProgressPubSub] Failed to subscribe to channel ${this.CHANNEL_PREFIX}${recruiterId}:`, error);
      this.logger.error('Failed to subscribe to progress updates:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from upload progress updates for a specific recruiter
   */
  async unsubscribeFromProgress(recruiterId: string): Promise<void> {
    try {
      const channel = `${this.CHANNEL_PREFIX}${recruiterId}`;
      
      // Remove the callback for this channel
      this.messageHandlers.delete(channel);

      if (!this.subscriberClient) {
        return;
      }
      
      await this.subscriberClient.unsubscribe(channel);
      this.logger.log(`Unsubscribed from progress updates for recruiter ${recruiterId}`);
    } catch (error) {
      this.logger.error('Failed to unsubscribe from progress updates:', error);
    }
  }

  /**
   * Publish upload started event
   */
  async publishUploadStarted(
    recruiterId: string,
    totalCandidates: number,
    totalBatches: number
  ): Promise<void> {
    await this.publishProgress({
      recruiterId,
      step: 'started',
      message: 'Upload processing started',
      progress_percentage: 0,
      total_candidates: totalCandidates,
      processed_candidates: 0,
      total_batches: totalBatches,
      current_batch: 0,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Publish upload processing event
   */
  async publishUploadProcessing(
    recruiterId: string,
    progress: number,
    currentBatch: number,
    totalBatches: number,
    processedCandidates: number,
    totalCandidates: number
  ): Promise<void> {
    await this.publishProgress({
      recruiterId,
      step: 'processing',
      message: `Processing batch ${currentBatch}/${totalBatches}`,
      progress_percentage: progress,
      total_candidates: totalCandidates,
      processed_candidates: processedCandidates,
      total_batches: totalBatches,
      current_batch: currentBatch,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Publish upload completed event
   */
  async publishUploadCompleted(
    recruiterId: string,
    totalCandidates: number,
    totalBatches: number
  ): Promise<void> {
    await this.publishProgress({
      recruiterId,
      step: 'completed',
      message: 'Upload processing completed successfully',
      progress_percentage: 100,
      total_candidates: totalCandidates,
      processed_candidates: totalCandidates,
      total_batches: totalBatches,
      current_batch: totalBatches,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Publish upload error event
   */
  async publishUploadError(
    recruiterId: string,
    errorMessage: string
  ): Promise<void> {
    await this.publishProgress({
      recruiterId,
      step: 'error',
      message: `Upload processing failed: ${errorMessage}`,
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
