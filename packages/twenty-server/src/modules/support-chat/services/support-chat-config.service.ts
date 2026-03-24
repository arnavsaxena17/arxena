import { Injectable } from '@nestjs/common';

import { SupportDriver } from 'src/engine/core-modules/environment/interfaces/support.interface';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

@Injectable()
export class SupportChatConfigService {
  constructor(private readonly environmentService: EnvironmentService) {}

  getDriver() {
    return this.environmentService.get('SUPPORT_DRIVER');
  }

  isChatwootEnabled() {
    return this.getDriver() === SupportDriver.Chatwoot;
  }

  getPublicWidgetConfig() {
    return {
      supportDriver: this.getDriver(),
      baseUrl: this.environmentService.get('SUPPORT_CHATWOOT_BASE_URL'),
      websiteToken: this.environmentService.get('SUPPORT_CHATWOOT_WEBSITE_TOKEN'),
      inboxIdentifier: this.environmentService.get(
        'SUPPORT_CHATWOOT_INBOX_IDENTIFIER',
      ),
      aiEnabled: this.environmentService.get('SUPPORT_AI_ENABLED'),
    };
  }

  getChatwootApiConfig() {
    return {
      baseUrl: this.environmentService.get('SUPPORT_CHATWOOT_BASE_URL'),
      accountId: this.environmentService.get('SUPPORT_CHATWOOT_ACCOUNT_ID'),
      apiAccessToken: this.environmentService.get(
        'SUPPORT_CHATWOOT_API_ACCESS_TOKEN',
      ),
    };
  }

  getChatwootWebhookSecret() {
    return this.environmentService.get('SUPPORT_CHATWOOT_WEBHOOK_SECRET');
  }

  getSupportWorkspaceId() {
    return this.environmentService.get('SUPPORT_CHAT_WORKSPACE_ID');
  }

  isAiEnabled() {
    return (
      this.isChatwootEnabled() &&
      this.environmentService.get('SUPPORT_AI_ENABLED') === true
    );
  }
}
