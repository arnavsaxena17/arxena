import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import {
    hasMatchingConnectedLinkedinAccount,
    hasMatchingConnectedWhatsappAccount,
    type UnipileLinkedinAccount,
    type UnipileWhatsappAccount,
    type WorkspaceMemberProfileUnipileFields,
} from 'twenty-shared';

import { LinkedinUnipileController } from '../../controllers/linkedin-unipile.controller';
import { WhatsappUnipileController } from '../../controllers/whatsapp-unipile.controller';
import { RecruiterProfileService } from '../recruiter-profile';

@Injectable()
export class ExtensionUnipileConnectionStatusService {
  private readonly logger = new Logger(
    ExtensionUnipileConnectionStatusService.name,
  );

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  async getConnectionStatusForCurrentUser(
    workspace: Workspace,
    apiToken: string,
    origin: string,
  ): Promise<{ linkedinConnected: boolean; whatsappConnected: boolean }> {
    const recruiterService = new RecruiterProfileService(
      this.staticGraphQLService,
    );
    let recruiterProfile: Awaited<
      ReturnType<typeof recruiterService.getRecruiterProfileFromCurrentUser>
    > | null = null;

    try {
      recruiterProfile =
        (await recruiterService.getRecruiterProfileFromCurrentUser(
          apiToken,
          origin,
        )) ?? null;
    } catch (err) {
      this.logger.warn(
        'Failed to load recruiter profile for extension unipile status',
        err,
      );
    }

    const profileFields: WorkspaceMemberProfileUnipileFields | null =
      recruiterProfile
        ? {
            phoneNumber: recruiterProfile.phoneNumber?.trim()
              ? recruiterProfile.phoneNumber
              : null,
            linkedinUrl: recruiterProfile.linkedinUrl?.trim()
              ? recruiterProfile.linkedinUrl
              : null,
            whatsappUnipileAccountId: recruiterProfile.whatsappUnipileAccountId
              ?.trim()
              ? recruiterProfile.whatsappUnipileAccountId
              : null,
            linkedinUnipileAccountId: recruiterProfile.linkedinUnipileAccountId
              ?.trim()
              ? recruiterProfile.linkedinUnipileAccountId
              : null,
          }
        : null;

    const linkedinCtrl = this.moduleRef.get(LinkedinUnipileController, {
      strict: false,
    });
    const waCtrl = this.moduleRef.get(WhatsappUnipileController, {
      strict: false,
    });

    let linkedinAccounts: UnipileLinkedinAccount[] = [];
    let whatsappAccounts: UnipileWhatsappAccount[] = [];

    try {
      const li = await linkedinCtrl.getAllAccounts(workspace);
      linkedinAccounts = li?.accounts ?? [];
    } catch (e) {
      this.logger.warn(
        'LinkedIn getAllAccounts failed for extension status',
        e,
      );
    }

    try {
      const wa = await waCtrl.getAllAccounts(workspace);
      whatsappAccounts = wa?.accounts ?? [];
    } catch (e) {
      this.logger.warn(
        'WhatsApp getAllAccounts failed for extension status',
        e,
      );
    }

    return {
      linkedinConnected: hasMatchingConnectedLinkedinAccount(
        linkedinAccounts,
        profileFields,
      ),
      whatsappConnected: hasMatchingConnectedWhatsappAccount(
        whatsappAccounts,
        profileFields,
      ),
    };
  }
}
