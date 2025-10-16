import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';

import { TimeManagement } from '../../arx-chat/services/time-management';
import { EventsGateway } from '../../whiskeysocket-baileys/events-gateway-module/events-gateway';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';

const CRON_DISABLED = process.env.NODE_ENV === 'production' ? false : false;

@Injectable()
export class WorkspaceMemberCleanupCronService {
  private isProcessing = false;
  private readonly logger = new Logger(WorkspaceMemberCleanupCronService.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  private async removeWorkspaceMemberFolder(memberDir: string, authDir: string): Promise<void> {
    try {
      // Remove WhatsApp service if it exists
      const whatsappService = this.eventsGateway.getWhatsappService(memberDir);
      if (whatsappService) {
        await whatsappService.clearAuthAndRestart(true);
        this.eventsGateway.deleteWhatsappService(memberDir);
      }

      // Remove auth directory and all its contents
      const memberAuthPath = path.join(authDir, memberDir);
      if (fs.existsSync(memberAuthPath)) {
        fs.rmSync(memberAuthPath, { recursive: true, force: true });
        this.logger.log(`Successfully removed directory for member: ${memberDir}`);
      }
    } catch (error) {
      this.logger.error(`Error removing directory for member ${memberDir}:`, error);
      throw error;
    }
  }

  @Cron(TimeManagement.crontabs.crontTabToExecuteWorkspaceMemberCleanup, {
    name: 'workspace-member-cleanup-task',
    disabled: CRON_DISABLED,
  })
  async handleCron() {
    if (this.isProcessing) {
      this.logger.warn('Previous job still running, skipping');
      return;
    }

    try {
      this.isProcessing = true;
      this.logger.log('Starting workspace member cleanup cycle');

      // Get all workspaces
      const workspaceIds = await this.workspaceQueryService.getWorkspaces();
      this.logger.log(`Processing ${workspaceIds.length} workspaces`);

      // Get all valid workspace member IDs
      const validMemberIds = new Set<string>();
      for (const workspaceId of workspaceIds) {
        try {
          const schema = this.workspaceQueryService.workspaceDataSourceService.getSchemaName(workspaceId);
          const query = `SELECT id FROM ${schema}."workspaceMember"`;
          const members = await this.workspaceQueryService.executeRawQuery(query, [], workspaceId);
          members.forEach((member: { id: string }) => validMemberIds.add(member.id));
        } catch (error) {
          this.logger.error(`Error processing workspace ${workspaceId}:`, error);
        }
      }

      // Check baileys_auth_info directory
      const authDir = 'baileys_auth_info';
      if (!fs.existsSync(authDir)) {
        this.logger.log('No auth directory found, skipping cleanup');
        return;
      }

      // Read sessionIds.json
      const sessionIdsPath = './sessionIds.json';
      let sessionData: Array<{recruiterId: string, recruiterName?: string}> = [];
      if (fs.existsSync(sessionIdsPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(sessionIdsPath, 'utf8'));
          // Handle backward compatibility - if it's an array of strings, convert to new format
          if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'string') {
            sessionData = data.map(id => ({ recruiterId: id, recruiterName: 'Unknown User' }));
          } else {
            sessionData = data;
          }
        } catch (error) {
          this.logger.error('Error reading sessionIds.json:', error);
          sessionData = [];
        }
      }

      // Filter out invalid session IDs
      const validSessionData = sessionData.filter(session => validMemberIds.has(session.recruiterId));

      // Clean up invalid auth directories and WhatsApp services
      const authDirs = fs.readdirSync(authDir);
      for (const memberDir of authDirs) {
        if (!validMemberIds.has(memberDir)) {
          this.logger.log(`Cleaning up auth directory for invalid member: ${memberDir}`);
          try {
            await this.removeWorkspaceMemberFolder(memberDir, authDir);
          } catch (error) {
            this.logger.error(`Failed to clean up member ${memberDir}:`, error);
            continue;
          }
        }
      }

      // Update sessionIds.json with only valid IDs
      fs.writeFileSync(sessionIdsPath, JSON.stringify(validSessionData));
      this.logger.log(`Cleaned up ${sessionData.length - validSessionData.length} invalid session IDs`);

    } catch (error) {
      this.logger.error('Error in workspace member cleanup job:', error);
    } finally {
      this.isProcessing = false;
      this.logger.log('Ending workspace member cleanup cycle');
    }
  }
} 