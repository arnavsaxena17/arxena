import { Module } from '@nestjs/common';

import { ObjectMetadataRepositoryModule } from 'src/engine/object-metadata-repository/object-metadata-repository.module';
import { ConnectedAccountObjectMetadata } from 'src/modules/connected-account/standard-objects/connected-account.object-metadata';
import { GmailFullSyncCommand } from 'src/modules/messaging/commands/gmail-full-sync.command';
import { GmailPartialSyncCommand } from 'src/modules/messaging/commands/gmail-partial-sync.command';
import { StartFetchAllWorkspacesMessagesCronCommand } from 'src/modules/messaging/commands/start-fetch-all-workspaces-messages.cron.command';
import { StopFetchAllWorkspacesMessagesCronCommand } from 'src/modules/messaging/commands/stop-fetch-all-workspaces-messages.cron.command';

@Module({
  imports: [
    ObjectMetadataRepositoryModule.forFeature([ConnectedAccountObjectMetadata]),
  ],
  providers: [
    GmailFullSyncCommand,
    GmailPartialSyncCommand,
    StartFetchAllWorkspacesMessagesCronCommand,
    StopFetchAllWorkspacesMessagesCronCommand,
  ],
})
export class FetchWorkspaceMessagesCommandsModule {}
