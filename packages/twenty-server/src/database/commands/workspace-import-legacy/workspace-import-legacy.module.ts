import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkspaceImportLegacyCommand } from 'src/database/commands/workspace-import-legacy/workspace-import-legacy.command';
import { WorkspaceImportLegacyService } from 'src/database/commands/workspace-import-legacy/workspace-import-legacy.service';
import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { UserWorkspaceModule } from 'src/engine/core-modules/user-workspace/user-workspace.module';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { WorkspaceModule } from 'src/engine/core-modules/workspace/workspace.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceEntity, UserEntity]),
    WorkspaceModule,
    ApplicationModule,
    UserWorkspaceModule,
  ],
  providers: [WorkspaceImportLegacyCommand, WorkspaceImportLegacyService],
  exports: [WorkspaceImportLegacyCommand],
})
export class WorkspaceImportLegacyModule {}
