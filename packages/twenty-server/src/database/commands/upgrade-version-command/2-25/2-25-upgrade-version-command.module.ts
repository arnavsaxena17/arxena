import { Module } from '@nestjs/common';

import { WorkspaceIteratorModule } from 'src/database/commands/command-runners/workspace-iterator.module';
import { EnsureArxWorkspaceIndexesCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000006-ensure-arx-workspace-indexes.command';
import { GlobalWorkspaceDataSourceModule } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-datasource.module';

@Module({
  imports: [WorkspaceIteratorModule, GlobalWorkspaceDataSourceModule],
  providers: [EnsureArxWorkspaceIndexesCommand],
})
export class V2_25_UpgradeVersionCommandModule {}
