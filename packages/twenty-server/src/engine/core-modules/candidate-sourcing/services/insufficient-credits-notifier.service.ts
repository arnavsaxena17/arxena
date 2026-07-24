import { Injectable } from '@nestjs/common';
import { render } from '@react-email/render';

import { EmailService } from 'src/engine/core-modules/email/email.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { InsufficientCreditsEmail } from 'twenty-emails';

@Injectable()
export class InsufficientCreditsNotifierService {
  constructor(
    private readonly emailService: EmailService,
    private readonly environmentService: EnvironmentService,
  ) {}

  async sendInsufficientCreditsEmail(
    userName: string,
    userEmail: string,
    workspaceDisplayName: string,
    currentCredits: number,
  ): Promise<void> {
    const emailData = {
      userName,
      workspaceDisplayName,
      currentCredits,
    };

    const emailTemplate = InsufficientCreditsEmail(emailData);
    const html = render(emailTemplate, { pretty: true });
    const text = render(emailTemplate, { plainText: true });

    await this.emailService.send({
      to: userEmail,
      bcc: this.environmentService.get('EMAIL_SYSTEM_ADDRESS'),
      from: `${this.environmentService.get(
        'EMAIL_FROM_NAME',
      )} <${this.environmentService.get('EMAIL_FROM_ADDRESS')}>`,
      subject: 'Insufficient OpenAI Credits',
      html,
      text,
    });
  }
} 