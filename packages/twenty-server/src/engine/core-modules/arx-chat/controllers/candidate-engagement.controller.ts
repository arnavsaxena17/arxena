import {
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Logger,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

import { ExtensionUnipileConnectionStatusService } from '../services/candidate-engagement/extension-unipile-connection-status.service';

@Controller('candidate-engagement')
@UseGuards(JwtAuthGuard)
export class CandidateEngagementController {
  private readonly logger = new Logger(CandidateEngagementController.name);

  constructor(
    private readonly extensionUnipileConnectionStatusService: ExtensionUnipileConnectionStatusService,
  ) {}

  @Get('unipile-connection-status')
  async getUnipileConnectionStatus(
    @AuthWorkspace() workspace: Workspace,
    @Req() req: Request,
    @Headers('x-origin-domain') originHeader?: string,
  ): Promise<{
    linkedinConnected: boolean;
    whatsappConnected: boolean;
    connectLinkedinToUnipileAutomatically: boolean;
  }> {
    const authHeader = req.headers.authorization;
    const apiToken =
      typeof authHeader === 'string'
        ? authHeader.replace(/^Bearer\s+/i, '').trim()
        : '';

    if (!apiToken) {
      throw new HttpException(
        'Authorization bearer token required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const origin =
      typeof originHeader === 'string' && originHeader.trim() !== ''
        ? originHeader.trim()
        : '';

    try {
      return await this.extensionUnipileConnectionStatusService.getConnectionStatusForCurrentUser(
        workspace,
        apiToken,
        origin,
      );
    } catch (err) {
      this.logger.error('unipile-connection-status failed', err);
      throw new HttpException(
        'Failed to resolve Unipile connection status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
