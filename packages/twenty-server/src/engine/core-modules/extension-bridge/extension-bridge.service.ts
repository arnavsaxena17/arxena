import { Injectable, Logger } from '@nestjs/common';
import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { ExtensionSocketGateway } from './extension-socket.gateway';

@Injectable()
export class ExtensionBridgeService {
  private readonly logger = new Logger(ExtensionBridgeService.name);

  constructor(
    private readonly extensionSocketGateway: ExtensionSocketGateway,
    private readonly accessTokenService: AccessTokenService,
  ) {}

  private async resolveWorkspaceMemberId(token: string): Promise<string> {
    const authContext = await this.accessTokenService.validateToken(token);
    if (!authContext.workspaceMemberId) {
      throw new Error('No workspaceMemberId found in token');
    }
    return authContext.workspaceMemberId;
  }

  private emitToExtensionRoom(
    workspaceMemberId: string,
    eventName: string,
    payload: any,
  ): void {
    const server = this.extensionSocketGateway.getServer();
    if (!server) {
      this.logger.error('Socket.IO server not initialized');
      return;
    }

    const room = this.extensionSocketGateway.getExtensionRoomForUser(
      workspaceMemberId,
    );
    this.logger.log(
      `Emitting ${eventName} to room ${room} for workspaceMemberId ${workspaceMemberId}`,
    );
    server.to(room).emit(eventName, payload);
  }

  // Resdex methods
  async resdexDownloadCv(token: string, payload: any): Promise<void> {
    const workspaceMemberId = await this.resolveWorkspaceMemberId(token);
    this.emitToExtensionRoom(workspaceMemberId, 'sendResdexDataToServer', payload);
  }

  async resdexOpenTabs(
    token: string,
    payload: { urls: string[]; current_table_id?: string },
  ): Promise<void> {
    const workspaceMemberId = await this.resolveWorkspaceMemberId(token);
    this.emitToExtensionRoom(workspaceMemberId, 'openAllTabsResdex', payload);
  }

  async resdexFetchAndSendProfiles(
    token: string,
    payload: { current_table_id?: string },
  ): Promise<void> {
    const workspaceMemberId = await this.resolveWorkspaceMemberId(token);
    this.emitToExtensionRoom(
      workspaceMemberId,
      'triggerSendDataOpenTabsGetResdexNaukriProfile',
      payload,
    );
  }

  async resdexCrawl(token: string, payload: any): Promise<void> {
    const workspaceMemberId = await this.resolveWorkspaceMemberId(token);
    this.emitToExtensionRoom(workspaceMemberId, 'startCrawlResdex', payload);
  }

  // Hiring Naukri methods
  async hiringNaukriCrawl(token: string, payload: any): Promise<void> {
    const workspaceMemberId = await this.resolveWorkspaceMemberId(token);
    this.emitToExtensionRoom(workspaceMemberId, 'startCrawlHiringNaukri', payload);
  }

  async hiringNaukriFetchAndSendProfiles(
    token: string,
    payload: { current_table_id?: string },
  ): Promise<void> {
    const workspaceMemberId = await this.resolveWorkspaceMemberId(token);
    this.emitToExtensionRoom(
      workspaceMemberId,
      'triggerSendDataOpenTabsGetResdexNaukriProfile',
      payload,
    );
  }

  // RMS Naukri methods
  async rmsNaukriCrawl(token: string, payload: any): Promise<void> {
    const workspaceMemberId = await this.resolveWorkspaceMemberId(token);
    this.emitToExtensionRoom(workspaceMemberId, 'startCrawlRMSNaukri', payload);
  }

  async rmsNaukriFetchAndSendProfiles(
    token: string,
    payload: any,
  ): Promise<void> {
    const workspaceMemberId = await this.resolveWorkspaceMemberId(token);
    this.emitToExtensionRoom(workspaceMemberId, 'uploadProfilesNaukri', payload);
  }

  // Naukri Common methods
  async naukriUpdateContact(token: string, payload: any): Promise<void> {
    const workspaceMemberId = await this.resolveWorkspaceMemberId(token);
    // This will trigger contact info fetch from the page
    this.emitToExtensionRoom(workspaceMemberId, 'naukriUpdateContact', payload);
  }

  async naukriUploadProfiles(token: string, payload: any): Promise<void> {
    const workspaceMemberId = await this.resolveWorkspaceMemberId(token);
    this.emitToExtensionRoom(workspaceMemberId, 'uploadProfilesNaukri', payload);
  }

  // LinkedIn methods
  async linkedinSendMessage(
    token: string,
    payload: { message: string; name: string; linkedin_url: string },
  ): Promise<void> {
    const workspaceMemberId = await this.resolveWorkspaceMemberId(token);
    this.emitToExtensionRoom(workspaceMemberId, 'send_linkedin_message', payload);
  }

  async linkedinSendConnectionRequest(
    token: string,
    payload: { message: string; name: string; linkedin_url: string },
  ): Promise<void> {
    const workspaceMemberId = await this.resolveWorkspaceMemberId(token);
    this.emitToExtensionRoom(
      workspaceMemberId,
      'send_linkedin_connection_request',
      payload,
    );
  }

  async linkedinGetUnreadMessages(token: string, payload: any): Promise<void> {
    const workspaceMemberId = await this.resolveWorkspaceMemberId(token);
    this.emitToExtensionRoom(
      workspaceMemberId,
      'get_linkedin_unread_messages',
      payload,
    );
  }

  async linkedinFetchCookies(token: string, payload: any): Promise<void> {
    const workspaceMemberId = await this.resolveWorkspaceMemberId(token);
    this.emitToExtensionRoom(workspaceMemberId, 'fetch_linkedin_cookies', payload);
  }

  // WhatsApp methods
  async whatsappSendMessage(
    token: string,
    payload: { phoneNumber: string; message: string; twentyMessageId: string },
  ): Promise<void> {
    const workspaceMemberId = await this.resolveWorkspaceMemberId(token);
    this.emitToExtensionRoom(workspaceMemberId, 'outgoing_message', payload);
  }

  async whatsappSendAttachment(
    token: string,
    payload: { phoneNumber: string; attachments: any[]; caption?: string },
  ): Promise<void> {
    const workspaceMemberId = await this.resolveWorkspaceMemberId(token);
    this.emitToExtensionRoom(workspaceMemberId, 'whatsapp_attachment', payload);
  }
}
