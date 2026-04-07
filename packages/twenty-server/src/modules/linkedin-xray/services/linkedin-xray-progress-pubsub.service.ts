import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import { RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';
import { LinkedinXrayProgressData } from 'src/modules/linkedin-xray/types/linkedin-xray-search-job.types';

@Injectable()
export class LinkedinXrayProgressPubSubService implements OnModuleDestroy {
  private readonly logger = new Logger(LinkedinXrayProgressPubSubService.name);
  private readonly channelPrefix = 'linkedin_xray_progress:';
  private readonly messageHandlers = new Map<
    string,
    (progressData: LinkedinXrayProgressData) => void
  >();
  private subscriberClient: any = null;

  constructor(private readonly redisClientService: RedisClientService) {}

  private ensureSubscriberClient() {
    if (this.subscriberClient) {
      return;
    }

    const Redis = require('ioredis');

    this.subscriberClient = new Redis({
      host: this.redisClientService.getClient().options.host,
      port: this.redisClientService.getClient().options.port,
      password: this.redisClientService.getClient().options.password,
      maxRetriesPerRequest: null,
    });

    this.subscriberClient.on('message', (channel: string, message: string) => {
      try {
        const progressData = JSON.parse(message) as LinkedinXrayProgressData;
        this.messageHandlers.get(channel)?.(progressData);
      } catch (error) {
        this.logger.error('Failed to parse LinkedIn x-ray progress message', error);
      }
    });
  }

  async publishProgress(progressData: LinkedinXrayProgressData): Promise<void> {
    const channel = `${this.channelPrefix}${progressData.recruiterId}`;
    await this.redisClientService
      .getClient()
      .publish(channel, JSON.stringify(progressData));
  }

  async subscribeToProgress(
    recruiterId: string,
    callback: (progressData: LinkedinXrayProgressData) => void,
  ): Promise<void> {
    this.ensureSubscriberClient();

    const channel = `${this.channelPrefix}${recruiterId}`;

    this.messageHandlers.set(channel, callback);
    await this.subscriberClient.subscribe(channel);
  }

  async unsubscribeFromProgress(recruiterId: string): Promise<void> {
    const channel = `${this.channelPrefix}${recruiterId}`;

    this.messageHandlers.delete(channel);

    if (!this.subscriberClient) {
      return;
    }

    await this.subscriberClient.unsubscribe(channel);
  }

  async publishStarted(
    data: Pick<
      LinkedinXrayProgressData,
      | 'recruiterId'
      | 'search_job_id'
      | 'raw_query'
      | 'search_engine'
      | 'job_id'
      | 'job_name'
      | 'pagination_mode'
    >,
  ): Promise<void> {
    await this.publishProgress({
      ...data,
      step: 'started',
      message: 'LinkedIn x-ray people fetch started',
      current_batch: 0,
      processed_candidates: 0,
      timestamp: new Date().toISOString(),
    });
  }

  async publishStatus(
    data: Omit<LinkedinXrayProgressData, 'step' | 'timestamp'>,
  ): Promise<void> {
    await this.publishProgress({
      ...data,
      step: 'status',
      timestamp: new Date().toISOString(),
    });
  }

  async publishPageFetched(
    data: Omit<LinkedinXrayProgressData, 'step' | 'timestamp'>,
  ): Promise<void> {
    await this.publishProgress({
      ...data,
      step: 'page_fetched',
      timestamp: new Date().toISOString(),
    });
  }

  async publishCompleted(
    data: Omit<LinkedinXrayProgressData, 'step' | 'timestamp' | 'message'>,
  ): Promise<void> {
    await this.publishProgress({
      ...data,
      step: 'completed',
      message: 'LinkedIn x-ray people fetch completed',
      timestamp: new Date().toISOString(),
    });
  }

  async publishError(
    data: Pick<
      LinkedinXrayProgressData,
      'recruiterId' | 'search_job_id' | 'raw_query' | 'search_engine'
    >,
    errorMessage: string,
  ): Promise<void> {
    await this.publishProgress({
      ...data,
      step: 'error',
      message: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriberClient) {
      await this.subscriberClient.quit();
      this.subscriberClient = null;
    }
  }
}
