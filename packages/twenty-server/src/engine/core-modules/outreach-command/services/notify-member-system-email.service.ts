import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { EmailService } from 'src/engine/core-modules/email/email.service';

export type NotifyMemberSystemEmailInput = {
  memberEmail?: string;
  prospectName?: string;
  // What the member must do, written by the workflow/LLM, e.g. "send an email".
  action?: string;
  prospectEmail?: string;
  prospectPhone?: string;
  subject?: string;
  body?: string;
  attachmentNames?: string;
  conversation?: string;
};

// Platform (noreply) email to the workspace member. Used when the member has no
// connected mailbox, so the workflow cannot email the prospect itself.
@Injectable()
export class NotifyMemberSystemEmailService {
  private readonly logger = new Logger(NotifyMemberSystemEmailService.name);

  constructor(private readonly emailService: EmailService) {}

  async execute({
    input,
  }: {
    input: NotifyMemberSystemEmailInput;
  }): Promise<{ success: boolean; to: string; subject: string; error: string }> {
    const to = input.memberEmail?.trim() ?? '';
    const prospect = input.prospectName?.trim() || 'the prospect';
    const action = input.action?.trim() || 'follow up';

    if (!isNonEmptyString(to)) {
      return {
        success: false,
        to: '',
        subject: '',
        error: 'No workspace member email to notify',
      };
    }

    const subject = `Action needed: ${action} - ${prospect}`;
    const lines = [
      `Please ${action} for ${prospect}.`,
      isNonEmptyString(input.prospectEmail?.trim())
        ? `Email: ${input.prospectEmail?.trim()}`
        : '',
      isNonEmptyString(input.prospectPhone?.trim())
        ? `Phone: ${input.prospectPhone?.trim()}`
        : '',
      isNonEmptyString(input.attachmentNames?.trim())
        ? `Attach: ${input.attachmentNames?.trim()}`
        : '',
      isNonEmptyString(input.subject?.trim())
        ? `\nSuggested subject: ${input.subject?.trim()}`
        : '',
      isNonEmptyString(input.body?.trim())
        ? `\nSuggested message:\n${input.body?.trim()}`
        : '',
      isNonEmptyString(input.conversation?.trim())
        ? `\nConversation so far:\n${input.conversation?.trim()}`
        : '',
      '\nThis is an automated message from your outreach workflow. Your email account is not connected, so nothing was sent to the prospect by email.',
    ].filter((line) => line !== '');

    try {
      await this.emailService.send({
        to,
        subject,
        text: lines.join('\n'),
      });

      return { success: true, to, subject, error: '' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`System email to member failed: ${message}`);

      return { success: false, to, subject, error: message };
    }
  }
}
