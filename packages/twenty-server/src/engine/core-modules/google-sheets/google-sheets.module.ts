import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { ApiKeyService } from 'src/engine/core-modules/auth/services/api-key.service';
import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { EmailService } from 'src/engine/core-modules/email/email.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import { UserWorkspace } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { AppToken } from '../app-token/app-token.entity';
import { JwtAuthStrategy } from '../auth/strategies/jwt.auth.strategy';
import { ProcessCandidatesService } from '../candidate-sourcing/jobs/process-candidates.service';
import { CandidateService } from '../candidate-sourcing/services/candidate.service';
import { ChatService } from '../candidate-sourcing/services/chat.service';
import { PersonService } from '../candidate-sourcing/services/person.service';
import { User } from '../user/user.entity';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';
import { Workspace } from '../workspace/workspace.entity';
import { GoogleSheetsDataController } from './google-sheet-data.controller';
import { GoogleSheetsController } from './google-sheets.controller';
import { GoogleSheetsService } from './google-sheets.service';

@Module({
  imports: [JwtModule, TypeORMModule, TypeOrmModule.forFeature([Workspace], 'core'), TypeOrmModule.forFeature([DataSourceEntity], 'metadata'), TypeOrmModule.forFeature([User], 'core'), TypeOrmModule.forFeature([AppToken], 'core'),    TypeOrmModule.forFeature([UserWorkspace], 'core'), DataSourceModule],
  providers: [
    PersonService,
    GoogleSheetsService,
    ProcessCandidatesService,
    JwtWrapperService,
    CandidateService,
    ChatService,
    WorkspaceQueryService,
    WorkspaceDataSourceService,
    EnvironmentService,
    ApiKeyService,
    JwtAuthStrategy,
    EmailService,
    AccessTokenService,
    DataSourceService, 
  ],
  controllers: [GoogleSheetsController, GoogleSheetsDataController],
  exports: [PersonService, CandidateService, ChatService, ProcessCandidatesService],
})
export class GoogleSheetsModule {}
