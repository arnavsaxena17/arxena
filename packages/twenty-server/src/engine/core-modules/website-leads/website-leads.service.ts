import { Injectable, Logger } from '@nestjs/common';

import { EmailService } from 'src/engine/core-modules/email/email.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

import { FreeTrialLeadDto } from './dto/free-trial-lead.dto';

const DEFAULT_FREE_TRIAL_LEAD_RECIPIENT = 'arnav@arxena.com';

@Injectable()
export class WebsiteLeadsService {
  private readonly logger = new Logger(WebsiteLeadsService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly environmentService: EnvironmentService,
  ) {}

  private formatOrgChartContext(
    context: FreeTrialLeadDto['orgChartContext'],
  ): string {
    if (!context) {
      return '—';
    }

    const lines = [
      context.companyName ? `Company viewed: ${context.companyName}` : null,
      context.selectedFunctionRoot
        ? `Function slice: ${context.selectedFunctionRoot}`
        : null,
      context.selectedCountry
        ? `Country slice: ${context.selectedCountry}`
        : null,
      context.nodeHeadline ? `Node / role: ${context.nodeHeadline}` : null,
    ].filter((line): line is string => Boolean(line));

    return lines.length > 0 ? lines.join('\n') : '—';
  }

  async sendFreeTrialLeadNotification(lead: FreeTrialLeadDto): Promise<void> {
    const to = DEFAULT_FREE_TRIAL_LEAD_RECIPIENT;

    const fromName = this.environmentService.get('EMAIL_FROM_NAME');
    const fromAddress = this.environmentService.get('EMAIL_FROM_ADDRESS');
    const from = `${fromName} <${fromAddress}>`;

    const subject = `[Arxena website] Free trial lead — ${lead.name.trim()}`;
    const text = [
      'New free trial lead from arxena.com',
      '',
      `Name: ${lead.name.trim()}`,
      `Email: ${lead.email.trim()}`,
      `Company: ${lead.company.trim()}`,
      `Source: ${lead.source}`,
      '',
      'Org chart context:',
      this.formatOrgChartContext(lead.orgChartContext),
    ].join('\n');

    await this.emailService.send({
      to,
      from,
      subject,
      text,
    });

    this.logger.log(
      `Queued free trial lead notification for ${lead.email.trim()} (source=${lead.source})`,
    );
  }
}
