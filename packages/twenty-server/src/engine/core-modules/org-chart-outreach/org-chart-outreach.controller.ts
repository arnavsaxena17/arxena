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
    IsIn,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    Min,
} from 'class-validator';

import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

import { LinkedinOutreachOpenerService } from './linkedin-outreach-opener.service';
import { OrgChartOutreachService } from './org-chart-outreach.service';
import type { GenerateOutreachMessageResponse } from './org-chart-outreach.types';

class OrgChartOutreachBodyDto {
  @IsIn(['linkedin_invite', 'whatsapp', 'google_contact', 'email'])
  channel: 'linkedin_invite' | 'whatsapp' | 'google_contact' | 'email';

  @IsString()
  jobId: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  subject?: string;
}

class GenerateOutreachMessageBodyDto {
  @IsString()
  targetIdentifier: string;

  @IsIn(['connection_request', 'inmail', 'message'])
  messageType: 'connection_request' | 'inmail' | 'message';

  @IsOptional()
  @IsBoolean()
  includeOrgChartLinks?: boolean;

  @IsOptional()
  @IsBoolean()
  includePosts?: boolean;

  @IsOptional()
  @IsBoolean()
  includeComments?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  postsLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  commentsLimit?: number;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsBoolean()
  refreshSenderProfile?: boolean;

  @IsOptional()
  @IsIn(['professional', 'warm', 'direct'])
  tone?: 'professional' | 'warm' | 'direct';

  @IsOptional()
  @IsString()
  customInstructions?: string;
}

@Controller('org-chart-outreach')
@UseGuards(JwtAuthGuard)
export class OrgChartOutreachController {
  constructor(
    private readonly orgChartOutreachService: OrgChartOutreachService,
    private readonly linkedinOutreachOpenerService: LinkedinOutreachOpenerService,
  ) {}

  @Post('generate-message')
  async generateMessage(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    body: GenerateOutreachMessageBodyDto,
    @AuthWorkspace() workspace: Workspace,
    @Req()
    request: {
      workspaceMemberId?: string;
      headers?: { authorization?: string };
    },
  ): Promise<GenerateOutreachMessageResponse> {
    const authHeader = request.headers?.authorization ?? '';
    const apiToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!apiToken) {
      throw new UnauthorizedException('Authorization required');
    }

    const workspaceMemberId = request.workspaceMemberId?.trim() ?? '';
    if (!workspaceMemberId) {
      throw new UnauthorizedException('Workspace member required');
    }

    return this.linkedinOutreachOpenerService.generateMessage({
      targetIdentifier: body.targetIdentifier,
      messageType: body.messageType,
      includeOrgChartLinks: body.includeOrgChartLinks,
      includePosts: body.includePosts,
      includeComments: body.includeComments,
      postsLimit: body.postsLimit,
      commentsLimit: body.commentsLimit,
      accountId: body.accountId,
      refreshSenderProfile: body.refreshSenderProfile,
      tone: body.tone,
      customInstructions: body.customInstructions,
      apiToken,
      workspaceMemberId,
      workspaceId: workspace.id,
    });
  }

  @Post('send')
  async send(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    body: OrgChartOutreachBodyDto,
    @Req() request: { headers?: { authorization?: string } },
  ): Promise<Record<string, unknown>> {
    const authHeader = request.headers?.authorization ?? '';
    const apiToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!apiToken) {
      throw new UnauthorizedException('Authorization required');
    }
    return this.orgChartOutreachService.run({
      channel: body.channel,
      jobId: body.jobId,
      message: body.message,
      templateId: body.templateId,
      linkedinUrl: body.linkedinUrl,
      phone: body.phone,
      email: body.email,
      fullName: body.fullName,
      jobTitle: body.jobTitle,
      companyName: body.companyName,
      subject: body.subject,
      apiToken,
    });
  }
}
