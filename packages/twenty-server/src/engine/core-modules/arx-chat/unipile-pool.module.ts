import { forwardRef, Module } from '@nestjs/common';

import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { MessageQueueModule } from 'src/engine/core-modules/message-queue/message-queue.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';

import { LinkedinUnipileEstimateAccountService } from './services/linkedin-unipile-estimate-account.service';
import { LinkedinUnipileMemberAccountResolverService } from './services/linkedin-unipile-member-account-resolver.service';
import { LinkedinUnipileRequestService } from './services/linkedin-unipile-request.service';
import { LinkedinUnipileSessionService } from './services/linkedin-unipile-session.service';
import { LinkedinUnipileTeardownSchedulerService } from './services/linkedin-unipile-teardown-scheduler.service';
import { LinkedinUnipileTeardownProcessor } from './services/linkedin-unipile-teardown.processor.job';
import { MemberLinkedinUnipileConnectionService } from './services/member-linkedin-unipile-connection.service';
import { UnipileAccountPoolService } from './services/unipile-account-pool.service';
import { UnipileInactivityCronService } from './services/unipile-inactivity-cron.service';
import { UnipileLinkedinSnapshotCacheCronService } from './services/unipile-linkedin-snapshot-cache.cron.service';
import { WhatsappUnipileRequestService } from './services/whatsapp-unipile-request.service';
import { WorkspaceMemberProfileUnipileService } from './services/workspace-member-profile-unipile.service';

@Module({
  imports: [
    TypeORMModule,
    forwardRef(() => WorkspaceModificationsModule),
    EnvironmentModule,
    GraphQLExecutionModule,
    MessageQueueModule,
  ],
  providers: [
    WorkspaceMemberProfileUnipileService,
    LinkedinUnipileEstimateAccountService,
    LinkedinUnipileMemberAccountResolverService,
    LinkedinUnipileRequestService,
    LinkedinUnipileSessionService,
    LinkedinUnipileTeardownSchedulerService,
    LinkedinUnipileTeardownProcessor,
    MemberLinkedinUnipileConnectionService,
    WhatsappUnipileRequestService,
    UnipileAccountPoolService,
    UnipileInactivityCronService,
    UnipileLinkedinSnapshotCacheCronService,
  ],
  exports: [
    UnipileAccountPoolService,
    WorkspaceMemberProfileUnipileService,
    LinkedinUnipileEstimateAccountService,
    LinkedinUnipileMemberAccountResolverService,
    LinkedinUnipileRequestService,
    LinkedinUnipileSessionService,
    LinkedinUnipileTeardownSchedulerService,
    MemberLinkedinUnipileConnectionService,
  ],
})
export class UnipilePoolModule {}
