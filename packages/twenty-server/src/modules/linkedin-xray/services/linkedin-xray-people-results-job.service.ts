import { Injectable } from '@nestjs/common';

import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { QueueJobOptions } from 'src/engine/core-modules/message-queue/drivers/interfaces/job-options.interface';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { LinkedinXrayPeopleResultsQueueProcessor } from 'src/modules/linkedin-xray/jobs/fetch-linkedin-xray-people-results.job';
import { LinkedinXrayPeopleResultsJobData } from 'src/modules/linkedin-xray/types/linkedin-xray-search-job.types';

@Injectable()
export class LinkedinXrayPeopleResultsJobService {
  constructor(
    @InjectMessageQueue(MessageQueue.googleSearchPeopleResultsQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  async enqueue(jobData: LinkedinXrayPeopleResultsJobData): Promise<void> {
    const options: QueueJobOptions = {
      id: jobData.searchJobId,
      priority: 1,
      retryLimit: 0,
    };

    await this.messageQueueService.add(
      LinkedinXrayPeopleResultsQueueProcessor.name,
      jobData,
      options,
    );
  }
}
