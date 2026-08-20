import { Injectable, Logger } from '@nestjs/common';

import { FacebookWhatsappWorkflowFormTemplateService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/facebook-whatsapp-workflow-form-template.service';
import {
  buildWorkflowApprovalFillPath,
  resolveWorkflowFormRegistryEntry,
  type WorkflowFormFieldSignatureInput,
} from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-form-template.registry';
import { WhatsappUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/whatsapp-unipile-request.service';
import { MessagingChannel } from 'src/engine/core-modules/arx-chat/utils/messaging-channel.util';

export type ApprovalNotifyRecipients = {
  WHATSAPP_OFFICIAL?: string;
  WHATSAPP_UNIPILE?: string;
  unipileAccountId?: string;
};

export type ApprovalNotifyInput = {
  channels: string[];
  contextText: string;
  // WhatsApp template {{2}} — resolved details / variables
  detailsText?: string;
  token: string;
  formFields: Array<
    WorkflowFormFieldSignatureInput & {
      name?: string;
      label?: string;
      placeholder?: string;
      value?: unknown;
      settings?: Record<string, unknown>;
    }
  >;
  forcedRegistryName?: string;
  recipients: ApprovalNotifyRecipients;
  fieldSummary?: string;
};

@Injectable()
export class ApprovalNotifierService {
  private readonly logger = new Logger(ApprovalNotifierService.name);

  constructor(
    private readonly facebookWhatsappWorkflowFormTemplateService: FacebookWhatsappWorkflowFormTemplateService,
    private readonly whatsappUnipileRequestService: WhatsappUnipileRequestService,
  ) {}

  buildFillUrl(token: string): string {
    const serverBaseUrl = (
      process.env.SERVER_BASE_URL ?? 'http://localhost:3000'
    ).replace(/\/$/, '');

    return `${serverBaseUrl}/workflow-approval/${buildWorkflowApprovalFillPath(encodeURIComponent(token))}`;
  }

  async notify(input: ApprovalNotifyInput): Promise<{
    results: Array<{ channel: string; status: string; detail?: string }>;
  }> {
    const registryEntry = resolveWorkflowFormRegistryEntry(
      input.formFields,
      input.forcedRegistryName,
    );
    const results: Array<{ channel: string; status: string; detail?: string }> =
      [];

    for (const channel of input.channels) {
      const normalizedChannel = channel.trim().toUpperCase();

      if (normalizedChannel === MessagingChannel.WHATSAPP_OFFICIAL) {
        const to =
          input.recipients.WHATSAPP_OFFICIAL ??
          process.env.WORKFLOW_APPROVAL_WHATSAPP_OFFICIAL_PHONE?.trim();

        if (!to) {
          results.push({
            channel: normalizedChannel,
            status: 'skipped',
            detail: 'No Official WhatsApp recipient phone configured',
          });
          continue;
        }

        try {
          const sendResult =
            await this.facebookWhatsappWorkflowFormTemplateService.sendWorkflowFormTemplate(
              {
                to: to.replace(/[^\d]/g, ''),
                registryName: registryEntry.name,
                contextText: input.contextText,
                detailsText:
                  input.detailsText ??
                  input.fieldSummary ??
                  'See form fields',
                token: input.token,
                formFields: input.formFields.map((field, index) => ({
                  name: field.name ?? `field_${index}`,
                  type: field.type,
                  label: field.label,
                  placeholder: field.placeholder,
                  value: field.value,
                  settings: field.settings,
                })),
              },
            );

          results.push({
            channel: normalizedChannel,
            status: sendResult.status,
            detail: registryEntry.name,
          });
        } catch (error) {
          const detail =
            error instanceof Error ? error.message : String(error);

          this.logger.error(
            `Official WhatsApp notify failed: ${detail}`,
          );
          results.push({
            channel: normalizedChannel,
            status: 'error',
            detail,
          });
        }
        continue;
      }

      if (normalizedChannel === MessagingChannel.WHATSAPP_UNIPILE) {
        const unipileResult = await this.notifyUnipile({
          ...input,
          detailsText:
            input.detailsText ?? input.fieldSummary ?? 'See form fields',
        });

        results.push({
          channel: normalizedChannel,
          ...unipileResult,
        });
        continue;
      }

      results.push({
        channel: normalizedChannel,
        status: 'skipped',
        detail: 'Channel not supported in MVP (WA Official / Unipile only)',
      });
    }

    return { results };
  }

  // Standalone Unipile smoke: context + fill link (no Meta templates)
  async notifyUnipile(input: {
    contextText: string;
    detailsText?: string;
    token: string;
    formFields: WorkflowFormFieldSignatureInput[];
    recipients: ApprovalNotifyRecipients;
    fieldSummary?: string;
  }): Promise<{ status: string; detail?: string }> {
    const phone =
      input.recipients.WHATSAPP_UNIPILE ??
      process.env.WORKFLOW_APPROVAL_WHATSAPP_UNIPILE_PHONE?.trim();
    const accountId =
      input.recipients.unipileAccountId ??
      process.env.WORKFLOW_APPROVAL_WHATSAPP_UNIPILE_ACCOUNT_ID?.trim() ??
      process.env.UNIPILE_WHATSAPP_ACCOUNT_ID?.trim();

    if (!phone || !accountId) {
      return {
        status: 'skipped',
        detail:
          'Missing Unipile recipient phone or account id (WORKFLOW_APPROVAL_WHATSAPP_UNIPILE_PHONE / ACCOUNT_ID)',
      };
    }

    const fillUrl = this.buildFillUrl(input.token);
    const fieldLines =
      input.detailsText ??
      input.fieldSummary ??
      input.formFields
        .map((field) => `- ${field.type}`)
        .join('\n');
    const isSingleBoolean =
      input.formFields.length === 1 &&
      input.formFields[0]?.type.toUpperCase() === 'BOOLEAN';
    const serverBaseUrl = (
      process.env.SERVER_BASE_URL ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    const encodedToken = encodeURIComponent(input.token);
    const booleanLinks = isSingleBoolean
      ? `\nYes: ${serverBaseUrl}/workflow-approval/${encodedToken}?decision=approve\nNo: ${serverBaseUrl}/workflow-approval/${encodedToken}?decision=reject`
      : '';

    const message = [
      input.contextText,
      '',
      'Details:',
      fieldLines,
      '',
      `Fill form: ${fillUrl}`,
      booleanLinks,
    ]
      .filter((line) => line !== undefined)
      .join('\n')
      .trim();

    const normalizedPhoneNumber = phone.replace(/[^\d+]/g, '');
    const attendeeId = `${normalizedPhoneNumber}@s.whatsapp.net`;

    try {
      await this.whatsappUnipileRequestService.makeUnipileRequest(
        `/v2/${encodeURIComponent(accountId)}/chats/send`,
        'POST',
        {
          users_ids: [attendeeId],
          text: message,
        },
      );

      return { status: 'sent', detail: fillUrl };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);

      this.logger.error(`Unipile notify failed: ${detail}`);

      return { status: 'error', detail };
    }
  }
}
