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
    IsArray,
    IsBoolean,
    IsIn,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    Max,
    Min,
} from 'class-validator';

import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

import { IcpExtractionService } from './icp-extraction.service';
import { IcpOutreachMessageService } from './icp-outreach-message.service';
import { LinkedinOutreachOpenerService } from './linkedin-outreach-opener.service';
import { OrgChartOutreachService } from './org-chart-outreach.service';
import type {
    ExtractIcpResponse,
    FetchIcpCandidatesResponse,
    GenerateIcpCommentResponse,
    GenerateIcpMessageResponse,
    GenerateOutreachMessageResponse,
    SendPostCommentResponse,
} from './org-chart-outreach.types';

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

class ExtractIcpBodyDto {
  @IsOptional()
  @IsObject()
  personProfile?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  companyProfile?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  personIdentifier?: string;

  @IsOptional()
  @IsString()
  companyIdentifier?: string;

  @IsOptional()
  @IsBoolean()
  includePosts?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  postsLimit?: number;

  @IsOptional()
  @IsString()
  accountId?: string;
}

class IcpBodyDto {
  @IsArray()
  @IsString({ each: true })
  industry: string[];

  @IsString()
  employee_range: string;

  @IsArray()
  @IsString({ each: true })
  tech_stack_signals: string[];

  @IsArray()
  @IsString({ each: true })
  buyer_titles: string[];

  @IsArray()
  @IsString({ each: true })
  pain_signals: string[];
}

class FetchIcpCandidatesBodyDto {
  @IsObject()
  icp: IcpBodyDto;

  @IsOptional()
  @IsString()
  chartFunction?: string;

  @IsIn(['apollo', 'sales_navigator'])
  source: 'apollo' | 'sales_navigator';

  @IsOptional()
  @IsString()
  keywords?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locations?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(25)
  limit?: number;

  @IsOptional()
  @IsBoolean()
  rank?: boolean;

  @IsOptional()
  @IsString()
  accountId?: string;
}

class IcpRankedCandidateDto {
  @IsString()
  company_name: string;

  @IsString()
  chart_function: string;

  @IsOptional()
  @IsString()
  fit_reasoning?: string;
}

class GenerateIcpMessageBodyDto {
  @IsObject()
  icp: IcpBodyDto;

  @IsOptional()
  @IsString()
  sells?: string;

  @IsOptional()
  @IsString()
  chartFunction?: string;

  @IsString()
  targetIdentifier: string;

  @IsIn(['connection_request', 'inmail', 'message'])
  messageType: 'connection_request' | 'inmail' | 'message';

  @IsOptional()
  @IsArray()
  rankedCandidates?: IcpRankedCandidateDto[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  recentPostDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  postsLimit?: number;

  @IsOptional()
  @IsIn(['professional', 'warm', 'direct'])
  tone?: 'professional' | 'warm' | 'direct';

  @IsOptional()
  @IsString()
  customInstructions?: string;

  @IsOptional()
  @IsString()
  accountId?: string;
}

class GenerateIcpCommentBodyDto {
  @IsObject()
  icp: IcpBodyDto;

  @IsOptional()
  @IsString()
  sells?: string;

  @IsOptional()
  @IsString()
  chartFunction?: string;

  @IsOptional()
  @IsString()
  personIdentifier?: string;

  @IsOptional()
  @IsString()
  postId?: string;

  @IsOptional()
  @IsString()
  postText?: string;

  @IsOptional()
  @IsArray()
  rankedCandidates?: IcpRankedCandidateDto[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3)
  variants?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  recentPostDays?: number;

  @IsOptional()
  @IsString()
  customInstructions?: string;

  @IsOptional()
  @IsString()
  accountId?: string;
}

class PostCommentMentionDto {
  @IsString()
  name: string;

  @IsString()
  profile_id: string;

  @IsOptional()
  @IsBoolean()
  is_company?: boolean;
}

class SendPostCommentBodyDto {
  @IsString()
  postId: string;

  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  commentId?: string;

  @IsOptional()
  @IsArray()
  mentions?: PostCommentMentionDto[];

  @IsOptional()
  @IsString()
  externalLink?: string;

  @IsOptional()
  @IsString()
  asOrganization?: string;

  @IsOptional()
  @IsString()
  accountId?: string;
}

@Controller('org-chart-outreach')
@UseGuards(JwtAuthGuard)
export class OrgChartOutreachController {
  constructor(
    private readonly orgChartOutreachService: OrgChartOutreachService,
    private readonly linkedinOutreachOpenerService: LinkedinOutreachOpenerService,
    private readonly icpExtractionService: IcpExtractionService,
    private readonly icpOutreachMessageService: IcpOutreachMessageService,
  ) {}

  private resolveAuthContext(request: {
    workspaceMemberId?: string;
    headers?: { authorization?: string };
  }): { apiToken: string; workspaceMemberId: string } {
    const authHeader = request.headers?.authorization ?? '';
    const apiToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!apiToken) {
      throw new UnauthorizedException('Authorization required');
    }

    const workspaceMemberId = request.workspaceMemberId?.trim() ?? '';
    if (!workspaceMemberId) {
      throw new UnauthorizedException('Workspace member required');
    }

    return { apiToken, workspaceMemberId };
  }

  @Post('icp/extract')
  async extractIcp(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    body: ExtractIcpBodyDto,
    @AuthWorkspace() workspace: Workspace,
    @Req()
    request: {
      workspaceMemberId?: string;
      headers?: { authorization?: string };
    },
  ): Promise<ExtractIcpResponse> {
    const authHeader = request.headers?.authorization ?? '';
    const apiToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!apiToken) {
      throw new UnauthorizedException('Authorization required');
    }

    const workspaceMemberId = request.workspaceMemberId?.trim() ?? '';
    if (!workspaceMemberId) {
      throw new UnauthorizedException('Workspace member required');
    }

    return this.icpExtractionService.extractIcp({
      personProfile: body.personProfile,
      companyProfile: body.companyProfile,
      personIdentifier: body.personIdentifier,
      companyIdentifier: body.companyIdentifier,
      includePosts: body.includePosts,
      postsLimit: body.postsLimit,
      accountId: body.accountId,
      apiToken,
      workspaceMemberId,
      workspaceId: workspace.id,
    });
  }

  @Post('icp/candidates')
  async fetchIcpCandidates(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    body: FetchIcpCandidatesBodyDto,
    @AuthWorkspace() workspace: Workspace,
    @Req()
    request: {
      workspaceMemberId?: string;
      headers?: { authorization?: string };
    },
  ): Promise<FetchIcpCandidatesResponse> {
    const authHeader = request.headers?.authorization ?? '';
    const apiToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!apiToken) {
      throw new UnauthorizedException('Authorization required');
    }

    const workspaceMemberId = request.workspaceMemberId?.trim() ?? '';
    if (!workspaceMemberId) {
      throw new UnauthorizedException('Workspace member required');
    }

    return this.icpExtractionService.fetchIcpCandidates({
      icp: body.icp,
      chartFunction: body.chartFunction,
      source: body.source,
      keywords: body.keywords,
      locations: body.locations,
      limit: body.limit,
      rank: body.rank,
      accountId: body.accountId,
      apiToken,
      workspaceMemberId,
      workspaceId: workspace.id,
    });
  }

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

  @Post('icp/generate-message')
  async generateIcpMessage(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    body: GenerateIcpMessageBodyDto,
    @AuthWorkspace() workspace: Workspace,
    @Req()
    request: {
      workspaceMemberId?: string;
      headers?: { authorization?: string };
    },
  ): Promise<GenerateIcpMessageResponse> {
    const { apiToken, workspaceMemberId } = this.resolveAuthContext(request);

    return this.icpOutreachMessageService.generateIcpMessage({
      icp: body.icp,
      sells: body.sells,
      chartFunction: body.chartFunction,
      targetIdentifier: body.targetIdentifier,
      messageType: body.messageType,
      rankedCandidates: body.rankedCandidates,
      recentPostDays: body.recentPostDays,
      postsLimit: body.postsLimit,
      tone: body.tone,
      customInstructions: body.customInstructions,
      accountId: body.accountId,
      apiToken,
      workspaceMemberId,
      workspaceId: workspace.id,
    });
  }

  @Post('icp/generate-comment')
  async generateIcpComment(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    body: GenerateIcpCommentBodyDto,
    @AuthWorkspace() workspace: Workspace,
    @Req()
    request: {
      workspaceMemberId?: string;
      headers?: { authorization?: string };
    },
  ): Promise<GenerateIcpCommentResponse> {
    const { apiToken, workspaceMemberId } = this.resolveAuthContext(request);

    return this.icpOutreachMessageService.generateIcpComment({
      icp: body.icp,
      sells: body.sells,
      chartFunction: body.chartFunction,
      personIdentifier: body.personIdentifier,
      postId: body.postId,
      postText: body.postText,
      rankedCandidates: body.rankedCandidates,
      variants: body.variants,
      recentPostDays: body.recentPostDays,
      customInstructions: body.customInstructions,
      accountId: body.accountId,
      apiToken,
      workspaceMemberId,
      workspaceId: workspace.id,
    });
  }

  @Post('posts/comment')
  async sendPostComment(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    body: SendPostCommentBodyDto,
    @AuthWorkspace() workspace: Workspace,
    @Req()
    request: {
      workspaceMemberId?: string;
      headers?: { authorization?: string };
    },
  ): Promise<SendPostCommentResponse> {
    const { apiToken, workspaceMemberId } = this.resolveAuthContext(request);

    return this.icpOutreachMessageService.sendPostComment({
      postId: body.postId,
      text: body.text,
      commentId: body.commentId,
      mentions: body.mentions,
      externalLink: body.externalLink,
      asOrganization: body.asOrganization,
      accountId: body.accountId,
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
