import { WhatsappService } from './whiskeysocket-baileys.service';
import { WhatsappController } from './whiskeysocket-baileys.controller';

import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { EnvironmentService } from 'src/engine/integrations/environment/environment.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { User } from 'src/engine/core-modules/user/user.entity';
import { AppToken } from 'src/engine/core-modules/app-token/app-token.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { UserModule } from 'src/engine/core-modules/user/user.module';
import { WorkspaceManagerModule } from 'src/engine/workspace-manager/workspace-manager.module';
import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { GoogleAuthController } from 'src/engine/core-modules/auth/controllers/google-auth.controller';
import { GoogleAPIsAuthController } from 'src/engine/core-modules/auth/controllers/google-apis-auth.controller';
import { VerifyAuthController } from 'src/engine/core-modules/auth/controllers/verify-auth.controller';
import { TokenService } from 'src/engine/core-modules/auth/services/token.service';
import { GoogleAPIsService } from 'src/engine/core-modules/auth/services/google-apis.service';
import { UserWorkspaceModule } from 'src/engine/core-modules/user-workspace/user-workspace.module';
import { SignInUpService } from 'src/engine/core-modules/auth/services/sign-in-up.service';
import { FeatureFlagEntity } from 'src/engine/core-modules/feature-flag/feature-flag.entity';
import { FileUploadModule } from 'src/engine/core-modules/file/file-upload/file-upload.module';
import { MicrosoftAuthController } from 'src/engine/core-modules/auth/controllers/microsoft-auth.controller';
import { AppTokenService } from 'src/engine/core-modules/app-token/services/app-token.service';
import { ObjectMetadataRepositoryModule } from 'src/engine/object-metadata-repository/object-metadata-repository.module';
import { ConnectedAccountWorkspaceEntity } from 'src/modules/connected-account/standard-objects/connected-account.workspace-entity';
import { CalendarChannelWorkspaceEntity } from 'src/modules/calendar/standard-objects/calendar-channel.workspace-entity';
import { MessageChannelWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-channel.workspace-entity';
import { OnboardingModule } from 'src/engine/core-modules/onboarding/onboarding.module';

import { EventsGateway } from './events-gateway-module/events-gateway';
import { Repository } from 'typeorm/repository/Repository';
import { EmailService } from 'src/engine/integrations/email/email.service';
import { JwtAuthStrategy } from '../auth/strategies/jwt.auth.strategy';
const jwtModule = JwtModule.registerAsync({
  useFactory: async (environmentService: EnvironmentService) => {
    return {
      secret: environmentService.get('ACCESS_TOKEN_SECRET'),
      signOptions: {
        expiresIn: environmentService.get('ACCESS_TOKEN_EXPIRES_IN'),
      },
    };
  },
  inject: [EnvironmentService],
});
@Module({
  imports: [
    jwtModule,
    FileUploadModule,
    DataSourceModule,
    UserModule,
    WorkspaceManagerModule,
    TypeORMModule,
    TypeOrmModule.forFeature([Workspace, User, AppToken, FeatureFlagEntity], 'core'),
    ObjectMetadataRepositoryModule.forFeature([ConnectedAccountWorkspaceEntity, MessageChannelWorkspaceEntity, CalendarChannelWorkspaceEntity]),
    HttpModule,
    UserWorkspaceModule,
    OnboardingModule,
  ],

  providers: [EventsGateway, WhatsappService, TokenService, JwtService, JwtAuthStrategy, EnvironmentService, Repository<User>, Repository<AppToken>, Repository<Workspace>, EmailService],
  controllers: [WhatsappController],

  exports: [EventsGateway],
})
export class WhatsappModule {}
