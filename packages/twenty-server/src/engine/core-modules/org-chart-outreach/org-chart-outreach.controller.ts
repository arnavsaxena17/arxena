import {
  BadRequestException,
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
import * as fs from 'fs';
import * as path from 'path';

import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

import { IcpExtractionService } from './icp-extraction.service';
import { IcpOutreachMessageService } from './icp-outreach-message.service';
import { LinkedinOutreachOpenerService } from './linkedin-outreach-opener.service';
import { OrgChartOutreachService } from './org-chart-outreach.service';
import type {
  ExtractIcpFromResumeResponse,
  ExtractIcpResponse,
  FetchIcpCandidatesResponse,
  GenerateIcpCommentResponse,
  GenerateIcpEmailResponse,
  GenerateIcpMessageResponse,
  GenerateIcpWhatsappResponse,
  GenerateOutreachMessageResponse,
  SendPostCommentResponse,
} from './org-chart-outreach.types';

class OrgChartOutreachBodyDto {
  @IsIn(['linkedin_invite', 'whatsapp', 'google_contact', 'email'])
  channel: 'linkedin_invite' | 'whatsapp' | 'google_contact' | 'email';

  @IsOptional()
  @IsString()
  projectId?: string;

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

  /** Generate Mom Test discovery questions (default true). */
  @IsOptional()
  @IsBoolean()
  includeMomTestQuestions?: boolean;

  /**
   * Per-person Mom Test context (user message only).
   * E.g. "rejected candidate, interviewed 2 months ago, warm relationship".
   */
  @IsOptional()
  @IsString()
  interviewContext?: string;

  @IsOptional()
  @IsString()
  accountId?: string;
}

class ExtractIcpFromResumeBodyDto {
  /** Absolute path to a local PDF/DOCX/DOC resume on the server filesystem. */
  @IsOptional()
  @IsString()
  resumePath?: string;

  /** Raw resume text when no local file path is provided. */
  @IsOptional()
  @IsString()
  resumeText?: string;

  /** Multipart sends booleans as strings — accepted as string | boolean. */
  @IsOptional()
  includePosts?: boolean | string;

  @IsOptional()
  postsLimit?: number | string;

  @IsOptional()
  includeMomTestQuestions?: boolean | string;

  @IsOptional()
  @IsString()
  interviewContext?: string;

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
  /** Optional — extracted automatically from the target's profile when omitted. */
  @IsOptional()
  @IsObject()
  icp?: IcpBodyDto;

  @IsOptional()
  @IsString()
  sells?: string;

  @IsOptional()
  @IsString()
  chartFunction?: string;

  /** LinkedIn public identifier or full profile URL. */
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

  /** Send the connection request after generation (connection_request only). */
  @IsOptional()
  @IsBoolean()
  execute?: boolean;

  @IsOptional()
  @IsString()
  accountId?: string;
}

class GenerateIcpChannelBodyDto {
  /** Optional — extracted automatically from the target's profile when omitted. */
  @IsOptional()
  @IsObject()
  icp?: IcpBodyDto;

  @IsOptional()
  @IsString()
  sells?: string;

  @IsOptional()
  @IsString()
  chartFunction?: string;

  /** LinkedIn public identifier or full profile URL. */
  @IsString()
  targetIdentifier: string;

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

  /** Send the message after generation. */
  @IsOptional()
  @IsBoolean()
  execute?: boolean;

  @IsOptional()
  @IsString()
  accountId?: string;
}

class GenerateIcpEmailBodyDto extends GenerateIcpChannelBodyDto {
  /** Recipient email — skips the contact-enrichment waterfall when provided. */
  @IsOptional()
  @IsString()
  email?: string;
}

class GenerateIcpWhatsappBodyDto extends GenerateIcpChannelBodyDto {
  /** Recipient phone — skips the contact-enrichment waterfall when provided. */
  @IsOptional()
  @IsString()
  phone?: string;
}

class GenerateIcpCommentBodyDto {
  /** Optional — extracted automatically from the post author's profile when omitted. */
  @IsOptional()
  @IsObject()
  icp?: IcpBodyDto;

  @IsOptional()
  @IsString()
  sells?: string;

  @IsOptional()
  @IsString()
  chartFunction?: string;

  /** LinkedIn public identifier or full profile URL of the post author. */
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

  /** Publish the first generated comment on the resolved post. */
  @IsOptional()
  @IsBoolean()
  execute?: boolean;

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
    @AuthWorkspace() workspace : WorkspaceEntity,
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
      includeMomTestQuestions: body.includeMomTestQuestions,
      interviewContext: body.interviewContext,
      accountId: body.accountId,
      apiToken,
      workspaceMemberId,
      workspaceId: workspace.id,
    });
  }

  /**
   * ICP extract from a raw resume (local file path or pasted resumeText).
   * LinkedIn URL in the resume → Unipile profile/company fetch (same as icp/extract).
   * Otherwise → parse CV, LLM websearch for company, then ICP + Mom Test.
   */
  @Post('icp/extract-from-resume')
  async extractIcpFromResume(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    body: ExtractIcpFromResumeBodyDto,
    @AuthWorkspace() workspace : WorkspaceEntity,
    @Req()
    request: {
      workspaceMemberId?: string;
      headers?: { authorization?: string };
    },
  ): Promise<ExtractIcpFromResumeResponse> {
    const { apiToken, workspaceMemberId } = this.resolveAuthContext(request);

    const resumePath = body.resumePath?.trim();
    const hasPath = Boolean(resumePath);
    const hasText = Boolean(body.resumeText?.trim());
    if (!hasPath && !hasText) {
      throw new BadRequestException(
        'Provide resumePath (local PDF/DOCX/DOC file) or resumeText',
      );
    }

    if (resumePath) {
      if (!path.isAbsolute(resumePath)) {
        throw new BadRequestException('resumePath must be an absolute file path');
      }
      if (!fs.existsSync(resumePath)) {
        throw new BadRequestException(`resumePath does not exist: ${resumePath}`);
      }
      const stats = fs.statSync(resumePath);
      if (!stats.isFile()) {
        throw new BadRequestException(`resumePath is not a file: ${resumePath}`);
      }
      const supported = /\.(pdf|docx|doc)$/i.test(resumePath);
      if (!supported) {
        throw new BadRequestException(
          'Invalid file type. Only PDF, DOCX, and DOC resumes are supported.',
        );
      }
    }

    const parseBoolean = (value: unknown): boolean | undefined => {
      if (typeof value === 'boolean') {
        return value;
      }
      if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') {
          return true;
        }
        if (value.toLowerCase() === 'false') {
          return false;
        }
      }
      return undefined;
    };

    const parseNumber = (value: unknown): number | undefined => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim()) {
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
      }
      return undefined;
    };

    return this.icpExtractionService.extractIcpFromResume({
      resumeFilePath: resumePath,
      resumeText: body.resumeText,
      includePosts: parseBoolean(body.includePosts),
      postsLimit: parseNumber(body.postsLimit),
      includeMomTestQuestions: parseBoolean(body.includeMomTestQuestions),
      interviewContext: body.interviewContext,
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
    @AuthWorkspace() workspace : WorkspaceEntity,
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
    @AuthWorkspace() workspace : WorkspaceEntity,
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
    @AuthWorkspace() workspace : WorkspaceEntity,
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
      execute: body.execute,
      accountId: body.accountId,
      apiToken,
      workspaceMemberId,
      workspaceId: workspace.id,
    });
  }

  @Post('icp/generate-email')
  async generateIcpEmail(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    body: GenerateIcpEmailBodyDto,
    @AuthWorkspace() workspace : WorkspaceEntity,
    @Req()
    request: {
      workspaceMemberId?: string;
      headers?: { authorization?: string };
    },
  ): Promise<GenerateIcpEmailResponse> {
    const { apiToken, workspaceMemberId } = this.resolveAuthContext(request);

    return this.icpOutreachMessageService.generateIcpEmail({
      icp: body.icp,
      sells: body.sells,
      chartFunction: body.chartFunction,
      targetIdentifier: body.targetIdentifier,
      rankedCandidates: body.rankedCandidates,
      recentPostDays: body.recentPostDays,
      postsLimit: body.postsLimit,
      tone: body.tone,
      customInstructions: body.customInstructions,
      email: body.email,
      execute: body.execute,
      accountId: body.accountId,
      apiToken,
      workspaceMemberId,
      workspaceId: workspace.id,
    });
  }

  @Post('icp/generate-whatsapp')
  async generateIcpWhatsapp(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    body: GenerateIcpWhatsappBodyDto,
    @AuthWorkspace() workspace : WorkspaceEntity,
    @Req()
    request: {
      workspaceMemberId?: string;
      headers?: { authorization?: string };
    },
  ): Promise<GenerateIcpWhatsappResponse> {
    const { apiToken, workspaceMemberId } = this.resolveAuthContext(request);

    return this.icpOutreachMessageService.generateIcpWhatsapp({
      icp: body.icp,
      sells: body.sells,
      chartFunction: body.chartFunction,
      targetIdentifier: body.targetIdentifier,
      rankedCandidates: body.rankedCandidates,
      recentPostDays: body.recentPostDays,
      postsLimit: body.postsLimit,
      tone: body.tone,
      customInstructions: body.customInstructions,
      phone: body.phone,
      execute: body.execute,
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
    @AuthWorkspace() workspace : WorkspaceEntity,
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
      execute: body.execute,
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
    @AuthWorkspace() workspace : WorkspaceEntity,
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
      projectId: body.projectId,
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
