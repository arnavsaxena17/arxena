import { Module } from '@nestjs/common';

import { WorkspaceModificationsModule } from '../workspace-modifications.module';

import { UnipileBackfillMemberMappingsCommand } from './unipile-backfill-member-mappings.command';

@Module({
  imports: [WorkspaceModificationsModule],
  providers: [UnipileBackfillMemberMappingsCommand],
})
export class WorkspaceModificationsCommandModule {}
