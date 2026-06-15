import { Injectable, Logger } from '@nestjs/common';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';

import { MemberLinkedinUnipileConnectionService } from '../member-linkedin-unipile-connection.service';
import { WorkspaceMemberProfileUnipileService } from '../workspace-member-profile-unipile.service';

@Injectable()
export class ExtensionUnipileConnectionStatusService {
  private readonly logger = new Logger(
    ExtensionUnipileConnectionStatusService.name,
  );

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly memberLinkedinUnipileConnectionService: MemberLinkedinUnipileConnectionService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
  ) {}

  async getConnectionStatusForCurrentUser(
    workspace: Workspace,
    apiToken: string,
    workspaceMemberId: string | undefined,
  ): Promise<{
    linkedinConnected: boolean;
    whatsappConnected: boolean;
    connectLinkedinToUnipileAutomatically: boolean;
  }> {
    if (!workspaceMemberId) {
      this.logger.warn(
        'unipile-connection-status: missing workspaceMemberId on JWT',
      );
      return {
        linkedinConnected: false,
        whatsappConnected: false,
        connectLinkedinToUnipileAutomatically: this.environmentService.get(
          'CONNECT_LINKEDIN_TO_UNIPILE_AUTOMATICALLY',
        ),
      };
    }

    let profile = null as Awaited<
      ReturnType<
        typeof this.workspaceMemberProfileUnipileService.getWorkspaceMemberProfileUnipileFields
      >
    >;

    try {
      profile =
        await this.workspaceMemberProfileUnipileService.getWorkspaceMemberProfileUnipileFields(
          workspaceMemberId,
          apiToken,
        );
    } catch (err) {
      this.logger.warn(
        'Failed to load workspace member profile for extension unipile status',
        err,
      );
    }

    const linkedinConnected =
      await this.memberLinkedinUnipileConnectionService.isLinkedinUsableForProfile(
        profile,
      );
    const whatsappConnected =
      await this.memberLinkedinUnipileConnectionService.isWhatsappConnectedForProfile(
        profile,
        workspace,
      );

    this.logger.log(
      `unipile-connection-status member=${workspaceMemberId} linkedinConnected=${linkedinConnected} whatsappConnected=${whatsappConnected} ` +
        `storedLinkedinId=${profile?.linkedinUnipileAccountId ?? 'none'} storedWhatsappId=${profile?.whatsappUnipileAccountId ?? 'none'}`,
    );

    return {
      linkedinConnected,
      whatsappConnected,
      connectLinkedinToUnipileAutomatically: this.environmentService.get(
        'CONNECT_LINKEDIN_TO_UNIPILE_AUTOMATICALLY',
      ),
    };
  }
}
