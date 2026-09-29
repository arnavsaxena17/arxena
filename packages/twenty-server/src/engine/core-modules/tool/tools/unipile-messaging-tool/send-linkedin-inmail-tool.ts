import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { FeatureFlagKey } from 'twenty-shared/types';

import { isAccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { LinkedinProviderIdStoreService } from 'src/engine/core-modules/outreach-command/services/linkedin-provider-id.store';
import {
  isSalesNavigatorLinkedInProviderId,
  pickLinkedinAttendeeIdFromUnipileProfile,
} from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-attendee-id.util';
import { extractLinkedinProfileId } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-profile-id.util';
import {
  SendLinkedinInmailToolInputZodSchema,
  type SendLinkedinInmailToolInput,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/types/send-linkedin-inmail-tool-input.type';
import { buildOutreachMockUnipileInmailResponseId } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/is-outreach-mock-unipile-enabled.util';
import {
  createLinkedinUnipileMessagingServiceForTools,
  getUnipileToolErrorMessage,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class SendLinkedinInmailTool implements Tool {
  private readonly logger = new Logger(SendLinkedinInmailTool.name);

  constructor(
    private readonly linkedinProviderIdStore: LinkedinProviderIdStoreService,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  description =
    'Send a LinkedIn Sales Navigator InMail via Unipile. Resolves ACw attendee ids; replies land in the SN mailbox. Classic ACo ids stay for regular messaging.';
  inputSchema = SendLinkedinInmailToolInputZodSchema;

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const input = parameters as SendLinkedinInmailToolInput;
    const unipileAccountId = input.unipileAccountId?.trim() ?? '';
    const linkedinProfileId =
      extractLinkedinProfileId(input.linkedinProfileId) ||
      extractLinkedinProfileId(input.linkedinUrl);
    const subject = input.subject ?? '';
    const body = input.body ?? '';

    if (!isNonEmptyString(unipileAccountId)) {
      return {
        success: false,
        message: 'Failed to send LinkedIn InMail',
        error: 'Unipile account ID is required',
      };
    }

    if (!isNonEmptyString(linkedinProfileId)) {
      return {
        success: false,
        message: 'Failed to send LinkedIn InMail',
        error: 'LinkedIn profile ID is required',
      };
    }

    try {
      const isMockUnipileEnabled =
        await this.featureFlagService.isFeatureEnabled(
          FeatureFlagKey.IS_OUTREACH_MOCK_UNIPILE_ENABLED,
          context.workspaceId,
        );

      if (isMockUnipileEnabled) {
        this.logger.log(
          `IS_OUTREACH_MOCK_UNIPILE_ENABLED: skipping Unipile InMail for ${linkedinProfileId}`,
        );

        return {
          success: true,
          message: 'LinkedIn InMail sent successfully',
          result: {
            mock: true,
            unipileAccountId,
            linkedinProfileId,
            salesNavigatorProviderId: linkedinProfileId,
            subject,
            body,
            response: {
              object: 'ChatStarted',
              chat_id: buildOutreachMockUnipileInmailResponseId(),
              message_id: buildOutreachMockUnipileInmailResponseId(),
            },
          },
        };
      }

      const messagingService = createLinkedinUnipileMessagingServiceForTools();
      const classicProviderId =
        await this.linkedinProviderIdStore.resolveForSend({
          workspaceId: context.workspaceId,
          candidateId: input.candidateId,
          identifier: linkedinProfileId,
          fetchProviderId: () =>
            messagingService.resolveProviderId(
              unipileAccountId,
              linkedinProfileId,
            ),
        });

      const salesNavigatorProviderId =
        await this.resolveSalesNavigatorProviderId({
          workspaceId: context.workspaceId,
          candidateId: input.candidateId,
          unipileAccountId,
          classicProviderId,
          identifier: linkedinProfileId,
        });

      if (!isNonEmptyString(salesNavigatorProviderId)) {
        return {
          success: false,
          message: 'Failed to send LinkedIn InMail',
          error: 'Sales Navigator provider id could not be resolved',
        };
      }

      const result = await messagingService.sendMessage(
        unipileAccountId,
        [salesNavigatorProviderId],
        body,
        undefined,
        undefined,
        undefined,
        subject,
        true,
        'sales_navigator',
      );

      this.logger.log(
        `LinkedIn InMail sent via Unipile account ${unipileAccountId} to SN ${salesNavigatorProviderId}`,
      );

      return {
        success: true,
        message: 'LinkedIn InMail sent successfully',
        result: {
          unipileAccountId,
          linkedinProfileId: classicProviderId,
          salesNavigatorProviderId,
          subject,
          body,
          response: result,
        },
      };
    } catch (error) {
      if (isAccountRateLimitDeferredError(error)) {
        throw error;
      }
      this.logger.error(
        `Failed to send LinkedIn InMail: ${getUnipileToolErrorMessage(error)}`,
      );

      return {
        success: false,
        message: 'Failed to send LinkedIn InMail',
        error: getUnipileToolErrorMessage(error),
      };
    }
  }

  private async resolveSalesNavigatorProviderId({
    workspaceId,
    candidateId,
    unipileAccountId,
    classicProviderId,
    identifier,
  }: {
    workspaceId?: string;
    candidateId?: string;
    unipileAccountId: string;
    classicProviderId: string;
    identifier: string;
  }): Promise<string> {
    if (isSalesNavigatorLinkedInProviderId(classicProviderId)) {
      await this.linkedinProviderIdStore.saveSalesNavigatorProviderId({
        workspaceId,
        candidateId,
        identifier,
        salesNavigatorProviderId: classicProviderId,
      });

      return classicProviderId;
    }

    const stored =
      await this.linkedinProviderIdStore.readStoredSalesNavigatorProviderId({
        workspaceId,
        candidateId,
        identifier,
      });

    if (isSalesNavigatorLinkedInProviderId(stored)) {
      return stored;
    }

    const productProfile =
      await this.linkedinUnipileRequestService.fetchLinkedinUserProfile(
        unipileAccountId,
        classicProviderId,
        {
          linkedinApi: 'sales_navigator',
          linkedinSections: [],
          notify: false,
        },
      );
    const salesNavigatorProviderId =
      pickLinkedinAttendeeIdFromUnipileProfile(productProfile);

    if (isSalesNavigatorLinkedInProviderId(salesNavigatorProviderId)) {
      await this.linkedinProviderIdStore.saveSalesNavigatorProviderId({
        workspaceId,
        candidateId,
        identifier,
        salesNavigatorProviderId,
      });
    }

    return salesNavigatorProviderId;
  }
}
