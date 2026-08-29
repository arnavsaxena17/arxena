import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { ApiKeyService } from 'src/engine/core-modules/api-key/services/api-key.service';
import { JwtTokenTypeEnum } from 'src/engine/core-modules/auth/types/jwt-token-type.enum';
import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

@Injectable()
export class OutreachWorkspaceAuthTokenService {
  private readonly logger = new Logger(OutreachWorkspaceAuthTokenService.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly apiKeyService: ApiKeyService,
    private readonly jwtWrapperService: JwtWrapperService,
  ) {}

  async resolveApiKeyToken(workspaceId: string): Promise<string | null> {
    const apiKeys = await this.workspaceQueryService.getApiKeys(workspaceId);
    const usable = apiKeys.find((apiKey) => this.apiKeyService.isActive(apiKey));
    const apiKeyId = usable?.id;

    if (!isNonEmptyString(apiKeyId)) {
      return null;
    }

    const token = await this.apiKeyService.generateApiKeyToken(
      workspaceId,
      apiKeyId,
    );

    return token?.token ?? null;
  }

  async resolveOrMint(workspaceId: string): Promise<string> {
    const apiKeyToken = await this.resolveApiKeyToken(workspaceId);

    if (isNonEmptyString(apiKeyToken)) {
      return apiKeyToken;
    }

    try {
      const apiKey =
        await this.apiKeyService.ensureWorkspaceApiKey(workspaceId);
      const createdToken = await this.apiKeyService.generateApiKeyToken(
        workspaceId,
        apiKey.id,
      );

      if (isNonEmptyString(createdToken?.token)) {
        return createdToken.token;
      }
    } catch (error) {
      this.logger.warn(
        `Could not ensure workspace API key for ${workspaceId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return this.jwtWrapperService.signAsyncOrThrow(
      {
        sub: workspaceId,
        workspaceId,
        type: JwtTokenTypeEnum.API_KEY,
      },
      { expiresIn: '2h' },
    );
  }
}
