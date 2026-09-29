import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { FeatureFlagKey } from 'twenty-shared/types';

import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { extractLinkedinProfileId } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-profile-id.util';
import {
  AcceptLinkedinReceivedInvitationToolInputZodSchema,
  type AcceptLinkedinReceivedInvitationToolInput,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/types/accept-linkedin-received-invitation-tool-input.type';
import {
  findMatchingLinkedinReceivedInvitation,
  type LinkedinReceivedInvitation,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/match-linkedin-received-invitation.util';
import { getUnipileToolErrorMessage } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class AcceptLinkedinReceivedInvitationTool implements Tool {
  private readonly logger = new Logger(
    AcceptLinkedinReceivedInvitationTool.name,
  );

  constructor(
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  description =
    'List Unipile received LinkedIn invitations, match the prospect, and accept if found. Returns matched/accepted flags for IF_ELSE branching.';
  inputSchema = AcceptLinkedinReceivedInvitationToolInputZodSchema;

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const input = parameters as AcceptLinkedinReceivedInvitationToolInput;
    const unipileAccountId = input.unipileAccountId?.trim() ?? '';
    const linkedinProfileId =
      extractLinkedinProfileId(input.linkedinProfileId) ||
      extractLinkedinProfileId(input.linkedinUrl);
    const linkedinPublicIdentifier =
      input.linkedinPublicIdentifier?.trim() ?? '';
    const providerId = input.providerId?.trim() ?? '';
    const limit = input.limit ?? 50;

    const matchIdentifiers = [
      linkedinProfileId,
      linkedinPublicIdentifier,
      providerId,
      input.linkedinProfileId?.trim() ?? '',
      extractLinkedinProfileId(input.linkedinUrl),
    ].filter(isNonEmptyString);

    if (!isNonEmptyString(unipileAccountId)) {
      return {
        success: false,
        message: 'Failed to accept LinkedIn received invitation',
        error: 'Unipile account ID is required',
      };
    }

    if (matchIdentifiers.length === 0) {
      return {
        success: false,
        message: 'Failed to accept LinkedIn received invitation',
        error:
          'At least one of linkedinProfileId, linkedinPublicIdentifier, providerId, or linkedinUrl is required',
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
          `IS_OUTREACH_MOCK_UNIPILE_ENABLED: treating inbound invite as accepted for ${matchIdentifiers[0]}`,
        );

        return {
          success: true,
          message: 'LinkedIn received invitation accepted successfully',
          result: {
            mock: true,
            matched: true,
            accepted: true,
            invitationId: 'mock-received-invitation',
            inviterId: providerId || linkedinProfileId || matchIdentifiers[0],
            inviterPublicIdentifier:
              linkedinPublicIdentifier ||
              linkedinProfileId ||
              matchIdentifiers[0],
            status: 'ACCEPTED',
          },
        };
      }

      const payload =
        await this.linkedinUnipileRequestService.fetchLinkedinInvitationsReceived(
          unipileAccountId,
          { limit },
        );

      const items = Array.isArray(payload.items)
        ? (payload.items as LinkedinReceivedInvitation[])
        : [];

      const match = findMatchingLinkedinReceivedInvitation(
        items,
        matchIdentifiers,
      );

      if (!match) {
        return {
          success: true,
          message: 'No matching LinkedIn received invitation',
          result: {
            matched: false,
            accepted: false,
            invitationsScanned: items.length,
          },
        };
      }

      const sharedSecret = match.specifics?.shared_secret?.trim() ?? '';

      if (!isNonEmptyString(sharedSecret)) {
        return {
          success: false,
          message: 'Failed to accept LinkedIn received invitation',
          error: 'Invitation shared_secret is missing',
        };
      }

      const response =
        await this.linkedinUnipileRequestService.handleLinkedinInvitationReceived(
          unipileAccountId,
          match.id,
          sharedSecret,
          'accept',
        );

      this.logger.log(
        `Accepted LinkedIn invitation ${match.id} from ${match.inviter?.inviter_public_identifier ?? match.inviter?.inviter_id}`,
      );

      return {
        success: true,
        message: 'LinkedIn received invitation accepted successfully',
        result: {
          matched: true,
          accepted: true,
          invitationId: match.id,
          inviterId: match.inviter?.inviter_id,
          inviterPublicIdentifier: match.inviter?.inviter_public_identifier,
          status:
            typeof response.status === 'string' ? response.status : 'ACCEPTED',
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to accept LinkedIn received invitation: ${getUnipileToolErrorMessage(error)}`,
      );

      return {
        success: false,
        message: 'Failed to accept LinkedIn received invitation',
        error: getUnipileToolErrorMessage(error),
      };
    }
  }
}
