import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { ExtensionPresenceService } from 'src/engine/core-modules/extension-bridge/extension-presence.service';
import { type FlatWorkspace } from 'src/engine/core-modules/workspace/types/flat-workspace.type';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { AuthWorkspaceMemberId } from 'src/engine/decorators/auth/auth-workspace-member-id.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

@Controller('extension-presence')
export class ExtensionPresenceController {
  constructor(
    private readonly extensionPresenceService: ExtensionPresenceService,
  ) {}

  @Post('heartbeat')
  @UseGuards(JwtAuthGuard)
  async heartbeat(
    @AuthWorkspace() workspace: FlatWorkspace,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
  ): Promise<{ ok: boolean; uninstallUrl: string | null }> {
    if (!workspaceMemberId) {
      throw new BadRequestException('Missing workspace member');
    }

    return this.extensionPresenceService.recordHeartbeat(
      workspace.id,
      workspaceMemberId,
    );
  }

  @Get('uninstalled')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async uninstalled(@Query('token') token?: string): Promise<string> {
    const recorded = await this.extensionPresenceService.recordUninstall(token);

    if (!recorded) {
      return '<!doctype html><title>Arxena</title><p>Could not record the extension uninstall.</p>';
    }

    return '<!doctype html><title>Arxena</title><p>The Arxena extension was removed from this browser.</p>';
  }
}
