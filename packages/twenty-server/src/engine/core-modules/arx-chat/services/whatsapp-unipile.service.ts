import { Logger } from '@nestjs/common';

import { UnipileV2Client } from 'src/engine/core-modules/unipile-client/unipile-v2.client';

export class WhatsappUnipileService {
  private readonly logger = new Logger(WhatsappUnipileService.name);
  private readonly unipileClient: UnipileV2Client;

  constructor(baseUrl: string, accessToken: string) {
    this.unipileClient = new UnipileV2Client(baseUrl, accessToken);
  }

  async getAccount(accountId: string): Promise<unknown> {
    return this.unipileClient.getAccount(accountId);
  }

  async resyncAccount(_accountId: string): Promise<{ status: string }> {
    return { status: 'skipped' };
  }

  async disconnectAccount(accountId: string): Promise<{ success: boolean }> {
    try {
      await this.unipileClient.deleteAccount(accountId);
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to disconnect WhatsApp account:', error);
      return { success: false };
    }
  }
}
