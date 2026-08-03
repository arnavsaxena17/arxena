import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { type Auth } from 'googleapis';
import { ConnectedAccountProvider } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { Repository } from 'typeorm';

import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { GoogleOAuth2ClientProvider } from 'src/modules/connected-account/oauth2-client-manager/drivers/google/google-oauth2-client.provider';

@Injectable()
export class GoogleConnectedAccountAuthService {
  private readonly logger = new Logger(GoogleConnectedAccountAuthService.name);

  constructor(
    private readonly accessTokenService: AccessTokenService,
    private readonly googleOAuth2ClientProvider: GoogleOAuth2ClientProvider,
    @InjectRepository(ConnectedAccountEntity)
    private readonly connectedAccountRepository: Repository<ConnectedAccountEntity>,
  ) {}

  // Replaces broken GET /rest/connectedAccounts (workspace object removed; accounts live in core).
  async loadGoogleOAuth2ClientFromToken(
    twentyToken: string,
    preferredHandle?: string,
  ): Promise<Auth.OAuth2Client | null> {
    if (!twentyToken) {
      return null;
    }

    try {
      const authContext =
        await this.accessTokenService.validateToken(twentyToken);
      const workspaceId = authContext.workspace?.id;
      const userWorkspaceId = authContext.userWorkspaceId;

      if (!isDefined(workspaceId)) {
        this.logger.warn('No workspaceId on auth context for Google OAuth');
        return null;
      }

      const googleAccounts = await this.connectedAccountRepository.find({
        where: {
          workspaceId,
          provider: ConnectedAccountProvider.GOOGLE,
        },
        order: { updatedAt: 'DESC' },
      });

      if (googleAccounts.length === 0) {
        this.logger.warn(
          `No Google connected account for workspace ${workspaceId}`,
        );
        return null;
      }

      let googleAccount: ConnectedAccountEntity | undefined;

      if (isDefined(preferredHandle)) {
        googleAccount = googleAccounts.find(
          (account) => account.handle === preferredHandle,
        );
      }

      if (!isDefined(googleAccount) && isDefined(userWorkspaceId)) {
        googleAccount = googleAccounts.find(
          (account) => account.userWorkspaceId === userWorkspaceId,
        );
      }

      if (!isDefined(googleAccount)) {
        googleAccount = googleAccounts[0];
      }

      return this.googleOAuth2ClientProvider.getClient(googleAccount.id);
    } catch (error) {
      this.logger.warn(
        `Failed to load Google OAuth client from token: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}
