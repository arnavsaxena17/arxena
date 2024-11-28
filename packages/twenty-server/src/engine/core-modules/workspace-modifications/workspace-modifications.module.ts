import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceQueryService } from './workspace-modifications.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { EnvironmentService } from 'src/engine/integrations/environment/environment.service';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { TypeORMModule } from 'src/database/typeorm/typeorm.module';

@Module({
  imports: [
    AuthModule,
    DataSourceModule,
    TypeORMModule,
    TypeOrmModule.forFeature([Workspace], 'core'),
    TypeOrmModule.forFeature([DataSourceEntity], 'metadata'),
  ],
  providers: [
    WorkspaceQueryService,
    EnvironmentService,
    WorkspaceDataSourceService,
  ],
  exports: [WorkspaceQueryService]
})
export class WorkspaceModificationsModule {}