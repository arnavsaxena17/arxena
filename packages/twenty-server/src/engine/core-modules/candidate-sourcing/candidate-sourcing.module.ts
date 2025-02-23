// import { CandidateSourcingController } from './controllers/candidate-sourcing.controller';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { CandidateSourcingController } from './controllers/candidate-sourcing.controller';
// import { JobService } from './services/job.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';
import { CandidateService } from './services/candidate.service';
import { ChatService } from './services/chat.service';
import { PersonService } from './services/person.service';
// import { API } from 'src/engine/core-modules/auth/services/token.service';
import { JwtService } from '@nestjs/jwt';
import { AppToken } from 'src/engine/core-modules/app-token/app-token.entity';
import { EmailService } from 'src/engine/core-modules/email/email.service';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { UserWorkspace } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { User } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { JwtAuthStrategy } from '../auth/strategies/jwt.auth.strategy';
import { GoogleSheetsService } from '../google-sheets/google-sheets.service';
import { CandidateQueueProcessor } from './jobs/process-candidates.job';
import { ProcessCandidatesService } from './jobs/process-candidates.service';


@Module({
  imports: [ AuthModule, WorkspaceModificationsModule,
    TypeORMModule,
    TypeOrmModule.forFeature([Workspace], 'core'),
    TypeOrmModule.forFeature([DataSourceEntity], 'metadata'),
    TypeOrmModule.forFeature([User], 'core'),
    TypeOrmModule.forFeature([AppToken], 'core'),
    TypeOrmModule.forFeature([UserWorkspace], 'core'),
    DataSourceModule, JwtModule
  ],
  controllers: [CandidateSourcingController],
  providers: [
    // JobService,
    PersonService,
    GoogleSheetsService,
    ProcessCandidatesService,
    CandidateService,
    ChatService,
    WorkspaceQueryService,
    WorkspaceDataSourceService,
    EnvironmentService,
    WorkspaceCacheStorageService,
    CandidateQueueProcessor,
    JwtService,
    JwtAuthStrategy,
    EmailService
  ],
  exports: [PersonService, CandidateService, ChatService, ProcessCandidatesService],

})
export class CandidateSourcingModule {}
