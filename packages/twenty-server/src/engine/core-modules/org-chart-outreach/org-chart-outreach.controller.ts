import {
    Body,
    Controller,
    Post,
    Req,
    UnauthorizedException,
    UseGuards,
    ValidationPipe,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';

import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

import { OrgChartOutreachService } from './org-chart-outreach.service';

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

@Controller('org-chart-outreach')
@UseGuards(JwtAuthGuard)
export class OrgChartOutreachController {
  constructor(private readonly orgChartOutreachService: OrgChartOutreachService) {}

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
