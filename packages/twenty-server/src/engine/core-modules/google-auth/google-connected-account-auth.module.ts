import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TokenModule } from 'src/engine/core-modules/auth/token/token.module';
import { GoogleConnectedAccountAuthService } from 'src/engine/core-modules/google-auth/google-connected-account-auth.service';
import { ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { OAuth2ClientManagerModule } from 'src/modules/connected-account/oauth2-client-manager/oauth2-client-manager.module';

@Module({
  imports: [
    TokenModule,
    OAuth2ClientManagerModule,
    TypeOrmModule.forFeature([ConnectedAccountEntity]),
  ],
  providers: [GoogleConnectedAccountAuthService],
  exports: [GoogleConnectedAccountAuthService],
})
export class GoogleConnectedAccountAuthModule {}
