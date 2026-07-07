import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

import { WarmPathResolverService } from './warm-path-resolver.service';
import type { WarmPathResolveResponse } from './warm-paths.types';

class ResolveWarmPathsBodyDto {
  @IsString()
  targetLinkedinUrl: string;

  @IsOptional()
  @IsString()
  linkedinUnipileAccountId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  maxBridges?: number;

  @IsOptional()
  @IsBoolean()
  expandViewerConnectors?: boolean;
}

@Controller('warm-paths')
@UseGuards(JwtAuthGuard)
export class WarmPathsController {
  constructor(private readonly warmPathResolverService: WarmPathResolverService) {}

  @Post('resolve')
  async resolve(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    body: ResolveWarmPathsBodyDto,
    @AuthWorkspace() workspace: Workspace,
    @Req()
    request: {
      workspaceMemberId?: string;
      headers?: { authorization?: string };
    },
  ): Promise<WarmPathResolveResponse> {
    const authHeader = request.headers?.authorization ?? '';
    const apiToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!apiToken) {
      throw new UnauthorizedException('Authorization required');
    }

    const workspaceMemberId = request.workspaceMemberId?.trim() ?? '';
    if (!workspaceMemberId) {
      throw new UnauthorizedException('Workspace member required');
    }

    return this.warmPathResolverService.resolve({
      targetLinkedinUrl: body.targetLinkedinUrl,
      linkedinUnipileAccountId: body.linkedinUnipileAccountId,
      maxBridges: body.maxBridges,
      expandViewerConnectors: body.expandViewerConnectors,
      apiToken,
      workspaceMemberId,
      workspaceId: workspace.id,
    });
  }
}
