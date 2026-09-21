import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  parseBrowserExtensionCookieArray,
  type BrowserExtensionCookie,
} from 'twenty-shared';

import { WorkspaceMemberUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-unipile.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

type CrunchbaseExtensionPersistCookiesDto = {
  cookies?: unknown;
};

@Controller('crunchbase')
@UseGuards(JwtAuthGuard)
export class CrunchbaseCookiesController {
  private readonly logger = new Logger(CrunchbaseCookiesController.name);

  constructor(
    private readonly workspaceMemberUnipileService: WorkspaceMemberUnipileService,
  ) {}

  @Post('extension/persist-cookies')
  async persistExtensionCookies(
    @Body() body: CrunchbaseExtensionPersistCookiesDto,
    @AuthWorkspace() _workspace: WorkspaceEntity,
    @Req()
    request: Request & {
      workspaceMemberId?: string;
      headers?: { authorization?: string };
    },
  ) {
    const workspaceMemberId = request.workspaceMemberId;
    const authToken =
      request.headers?.authorization?.replace(/^Bearer\s+/i, '') ?? '';

    if (!workspaceMemberId) {
      throw new HttpException(
        'workspaceMemberId required (user auth only)',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!authToken) {
      throw new HttpException(
        'Authorization header required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const cookies = parseBrowserExtensionCookieArray(body.cookies);

    if (cookies === null) {
      throw new HttpException(
        'cookies must be a JSON array of Crunchbase browser cookie objects',
        HttpStatus.BAD_REQUEST,
      );
    }

    const hasAuthCookie = cookies.some(
      (cookie: BrowserExtensionCookie) => cookie.name === 'authcookie',
    );

    if (!hasAuthCookie) {
      this.logger.warn(
        `Persisting Crunchbase cookies without authcookie for workspaceMemberId=${workspaceMemberId}`,
      );
    }

    const persisted =
      await this.workspaceMemberUnipileService.updateWorkspaceMemberCrunchbaseCookies(
        authToken,
        workspaceMemberId,
        cookies,
        { touchLastSyncedAt: true },
      );

    return {
      ok: true,
      cookieCount: persisted.crunchbaseCookies.length,
      lastSyncedAt: persisted.crunchbaseCookiesLastSyncedAt,
      changed: persisted.cookiesChanged,
      hasAuthCookie,
    };
  }
}
