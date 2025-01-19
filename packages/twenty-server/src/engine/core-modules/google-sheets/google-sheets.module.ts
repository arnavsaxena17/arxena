import { Module } from '@nestjs/common';
import { GoogleSheetsService } from './google-sheets.service';
import { GoogleSheetsController } from './google-sheets.controller';
import { AuthModule } from '../auth/auth.module';
import { GoogleSheetsDataController } from './google-sheet-data.controller';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';
import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { Workspace } from '../workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { TokenService } from '../auth/services/token.service';
import { EnvironmentService } from 'src/engine/integrations/environment/environment.service';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthStrategy } from '../auth/strategies/jwt.auth.strategy';
import { User } from '../user/user.entity';
import { AppToken } from '../app-token/app-token.entity';
import { EmailService } from 'src/engine/integrations/email/email.service';
import { ChatService } from '../candidate-sourcing/services/chat.service';
import { ProcessCandidatesService } from '../candidate-sourcing/jobs/process-candidates.service';
import { CandidateService } from '../candidate-sourcing/services/candidate.service';
import { PersonService } from '../candidate-sourcing/services/person.service';
import { CandidateQueueProcessor } from '../candidate-sourcing/jobs/process-candidates.job';

@Module({
  imports: [AuthModule, TypeORMModule, TypeOrmModule.forFeature([Workspace], 'core'), TypeOrmModule.forFeature([DataSourceEntity], 'metadata'), TypeOrmModule.forFeature([User], 'core'), TypeOrmModule.forFeature([AppToken], 'core'), DataSourceModule],
  providers: [
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
    EmailService,
  ],
  controllers: [GoogleSheetsController, GoogleSheetsDataController],
  exports: [PersonService, CandidateService, ChatService, ProcessCandidatesService],
})
export class GoogleSheetsModule {}
