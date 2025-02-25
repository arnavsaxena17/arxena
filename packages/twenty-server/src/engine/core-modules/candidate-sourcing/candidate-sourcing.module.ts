// import { CandidateSourcingController } from './controllers/candidate-sourcing.controller';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { CandidateSourcingController } from './controllers/candidate-sourcing.controller';
// import { JobService } from './services/job.service';
import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { AppToken } from 'src/engine/core-modules/app-token/app-token.entity';
import { TokenService } from 'src/engine/core-modules/auth/services/token.service';
import { User } from 'src/engine/core-modules/user/user.entity';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { EmailService } from 'src/engine/integrations/email/email.service';
import { EnvironmentService } from 'src/engine/integrations/environment/environment.service';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { JwtAuthStrategy } from '../auth/strategies/jwt.auth.strategy';
import { GoogleSheetsService } from '../google-sheets/google-sheets.service';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';
import { CandidateQueueProcessor } from './jobs/process-candidates.job';
import { ProcessCandidatesService } from './jobs/process-candidates.service';
import { CandidateService } from './services/candidate.service';
import { ChatService } from './services/chat.service';
import { PersonService } from './services/person.service';


@Module({
  imports: [ AuthModule, WorkspaceModificationsModule,
    TypeORMModule,
    TypeOrmModule.forFeature([Workspace], 'core'),
    TypeOrmModule.forFeature([DataSourceEntity], 'metadata'),
    TypeOrmModule.forFeature([User], 'core'),
    TypeOrmModule.forFeature([AppToken], 'core'),
    DataSourceModule, 
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
    TokenService,
    CandidateQueueProcessor,
    JwtService,
    JwtAuthStrategy,
    EmailService
  ],
  exports: [PersonService, CandidateService, ChatService, ProcessCandidatesService],

})
export class CandidateSourcingModule {}
