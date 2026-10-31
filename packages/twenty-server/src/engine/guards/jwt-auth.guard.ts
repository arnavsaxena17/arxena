import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { bindDataToRequestObject } from 'src/engine/utils/bind-data-to-request-object.util';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly accessTokenService: AccessTokenService,
    private readonly workspaceStorageCacheService: WorkspaceCacheStorageService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    try {
      const data =
        await this.accessTokenService.validateTokenByRequest(request);
      const metadataVersion = data.workspace
        ? await this.workspaceStorageCacheService.getMetadataVersion(
            data.workspace.id,
          )
        : undefined;

      if (
        !isDefined(data.apiKey) &&
        !isDefined(data.userWorkspaceId) &&
        !isDefined(data.application)
      ) {
        this.logger.warn(
          `Auth failed: no apiKey, userWorkspaceId, or application in context`,
        );

        // Without this the request falls through to Nest's default
        // ForbiddenException (403), which hides expired/invalid tokens behind a
        // permission error.
        throw new UnauthorizedException('Invalid authentication token');
      }

      bindDataToRequestObject(data, request, metadataVersion);

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.warn(`Auth failed: ${errorMessage}`);

      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }
}
