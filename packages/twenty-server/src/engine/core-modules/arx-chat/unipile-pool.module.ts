import { forwardRef, Module } from '@nestjs/common';

import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';

import { LinkedinUnipileRequestService } from './services/linkedin-unipile-request.service';
import { UnipileAccountPoolService } from './services/unipile-account-pool.service';
import { UnipileInactivityCronService } from './services/unipile-inactivity-cron.service';
import { WhatsappUnipileRequestService } from './services/whatsapp-unipile-request.service';
import { WorkspaceMemberProfileUnipileService } from './services/workspace-member-profile-unipile.service';

@Module({
  imports: [
    TypeORMModule,
    forwardRef(() => WorkspaceModificationsModule),
    GraphQLExecutionModule,
  ],
  providers: [
    WorkspaceMemberProfileUnipileService,
    LinkedinUnipileRequestService,
    WhatsappUnipileRequestService,
    UnipileAccountPoolService,
    UnipileInactivityCronService,
  ],
  exports: [UnipileAccountPoolService, WorkspaceMemberProfileUnipileService],
})
export class UnipilePoolModule {}
