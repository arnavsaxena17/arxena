import { Module } from '@nestjs/common';

import { BrightDataModule } from 'src/engine/core-modules/bright-data/bright-data.module';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { MessageQueueModule } from 'src/engine/core-modules/message-queue/message-queue.module';
import { LinkedinXrayController } from 'src/modules/linkedin-xray/linkedin-xray.controller';
import { LinkedinXrayProgressController } from 'src/modules/linkedin-xray/linkedin-xray-progress.controller';
import { LinkedinXrayPeopleResultsQueueProcessor } from 'src/modules/linkedin-xray/jobs/fetch-linkedin-xray-people-results.job';
import { LinkedinXrayPeopleResultsJobService } from 'src/modules/linkedin-xray/services/linkedin-xray-people-results-job.service';
import { LinkedinXrayProgressPubSubService } from 'src/modules/linkedin-xray/services/linkedin-xray-progress-pubsub.service';
import { LinkedinXrayService } from 'src/modules/linkedin-xray/linkedin-xray.service';

@Module({
  imports: [BrightDataModule, MessageQueueModule, GraphQLExecutionModule],
  controllers: [LinkedinXrayController, LinkedinXrayProgressController],
  providers: [
    LinkedinXrayService,
    LinkedinXrayPeopleResultsJobService,
    LinkedinXrayPeopleResultsQueueProcessor,
    LinkedinXrayProgressPubSubService,
  ],
  exports: [LinkedinXrayService, LinkedinXrayPeopleResultsJobService],
})
export class LinkedinXrayModule {}
