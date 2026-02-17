import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { ExtensionBridgeService } from './extension-bridge.service';

@Controller('extension-bridge')
@UseGuards(JwtAuthGuard)
export class ExtensionBridgeController {
  constructor(private readonly extensionBridgeService: ExtensionBridgeService) {}

  private extractToken(headers: Headers): string {
    const authHeader = headers['authorization'] || headers['Authorization'];
    if (!authHeader || typeof authHeader !== 'string') {
      throw new Error('Missing Authorization header');
    }
    const token = authHeader.replace('Bearer ', '');
    return token;
  }

  // Resdex endpoints
  @Post('resdex-download-cv')
  async resdexDownloadCv(
    @Headers() headers: Headers,
    @Body() payload: any,
  ): Promise<{ success: boolean }> {
    const token = this.extractToken(headers);
    await this.extensionBridgeService.resdexDownloadCv(token, payload);
    return { success: true };
  }

  @Post('resdex-open-tabs')
  async resdexOpenTabs(
    @Headers() headers: Headers,
    @Body() payload: { urls: string[]; current_table_id?: string },
  ): Promise<{ success: boolean }> {
    const token = this.extractToken(headers);
    await this.extensionBridgeService.resdexOpenTabs(token, payload);
    return { success: true };
  }

  @Post('resdex-fetch-and-send-profiles')
  async resdexFetchAndSendProfiles(
    @Headers() headers: Headers,
    @Body() payload: { current_table_id?: string },
  ): Promise<{ success: boolean }> {
    const token = this.extractToken(headers);
    await this.extensionBridgeService.resdexFetchAndSendProfiles(token, payload);
    return { success: true };
  }

  @Post('resdex-crawl')
  async resdexCrawl(
    @Headers() headers: Headers,
    @Body() payload: any,
  ): Promise<{ success: boolean }> {
    const token = this.extractToken(headers);
    await this.extensionBridgeService.resdexCrawl(token, payload);
    return { success: true };
  }

  // Hiring Naukri endpoints
  @Post('hiring-naukri-crawl')
  async hiringNaukriCrawl(
    @Headers() headers: Headers,
    @Body() payload: any,
  ): Promise<{ success: boolean }> {
    const token = this.extractToken(headers);
    await this.extensionBridgeService.hiringNaukriCrawl(token, payload);
    return { success: true };
  }

  @Post('hiring-naukri-fetch-and-send-profiles')
  async hiringNaukriFetchAndSendProfiles(
    @Headers() headers: Headers,
    @Body() payload: { current_table_id?: string },
  ): Promise<{ success: boolean }> {
    const token = this.extractToken(headers);
    await this.extensionBridgeService.hiringNaukriFetchAndSendProfiles(
      token,
      payload,
    );
    return { success: true };
  }

  // RMS Naukri endpoints
  @Post('rms-naukri-crawl')
  async rmsNaukriCrawl(
    @Headers() headers: Headers,
    @Body() payload: any,
  ): Promise<{ success: boolean }> {
    const token = this.extractToken(headers);
    await this.extensionBridgeService.rmsNaukriCrawl(token, payload);
    return { success: true };
  }

  @Post('rms-naukri-fetch-and-send-profiles')
  async rmsNaukriFetchAndSendProfiles(
    @Headers() headers: Headers,
    @Body() payload: any,
  ): Promise<{ success: boolean }> {
    const token = this.extractToken(headers);
    await this.extensionBridgeService.rmsNaukriFetchAndSendProfiles(
      token,
      payload,
    );
    return { success: true };
  }

  // Naukri Common endpoints
  @Post('naukri-update-contact')
  async naukriUpdateContact(
    @Headers() headers: Headers,
    @Body() payload: any,
  ): Promise<{ success: boolean }> {
    const token = this.extractToken(headers);
    await this.extensionBridgeService.naukriUpdateContact(token, payload);
    return { success: true };
  }

  @Post('naukri-upload-profiles')
  async naukriUploadProfiles(
    @Headers() headers: Headers,
    @Body() payload: any,
  ): Promise<{ success: boolean }> {
    const token = this.extractToken(headers);
    await this.extensionBridgeService.naukriUploadProfiles(token, payload);
    return { success: true };
  }

  // LinkedIn endpoints
  @Post('linkedin-send-message')
  async linkedinSendMessage(
    @Headers() headers: Headers,
    @Body() payload: { message: string; name: string; linkedin_url: string },
  ): Promise<{ success: boolean }> {
    const token = this.extractToken(headers);
    await this.extensionBridgeService.linkedinSendMessage(token, payload);
    return { success: true };
  }

  @Post('linkedin-send-connection-request')
  async linkedinSendConnectionRequest(
    @Headers() headers: Headers,
    @Body() payload: { message: string; name: string; linkedin_url: string },
  ): Promise<{ success: boolean }> {
    const token = this.extractToken(headers);
    await this.extensionBridgeService.linkedinSendConnectionRequest(
      token,
      payload,
    );
    return { success: true };
  }

  @Post('linkedin-get-unread-messages')
  async linkedinGetUnreadMessages(
    @Headers() headers: Headers,
    @Body() payload: any,
  ): Promise<{ success: boolean }> {
    const token = this.extractToken(headers);
    await this.extensionBridgeService.linkedinGetUnreadMessages(
      token,
      payload,
    );
    return { success: true };
  }

  @Post('linkedin-fetch-cookies')
  async linkedinFetchCookies(
    @Headers() headers: Headers,
    @Body() payload: any,
  ): Promise<{ success: boolean }> {
    const token = this.extractToken(headers);
    await this.extensionBridgeService.linkedinFetchCookies(token, payload);
    return { success: true };
  }

  // WhatsApp endpoints
  @Post('whatsapp-send-message')
  async whatsappSendMessage(
    @Headers() headers: Headers,
    @Body() payload: {
      phoneNumber: string;
      message: string;
      twentyMessageId: string;
    },
  ): Promise<{ success: boolean }> {
    const token = this.extractToken(headers);
    await this.extensionBridgeService.whatsappSendMessage(token, payload);
    return { success: true };
  }

  @Post('whatsapp-send-attachment')
  async whatsappSendAttachment(
    @Headers() headers: Headers,
    @Body() payload: {
      phoneNumber: string;
      attachments: any[];
      caption?: string;
    },
  ): Promise<{ success: boolean }> {
    const token = this.extractToken(headers);
    await this.extensionBridgeService.whatsappSendAttachment(token, payload);
    return { success: true };
  }
}
