import {
  Body,
  Controller,
  Logger,
  Post,
  Req,
  Res
} from '@nestjs/common';
import { UnipileWebhookService } from '../services/unipile-webhook.service';
import type {
  UnipileWebhookPayload
} from '../types/unipile-webhook.types';


@Controller('linkedin-unipile-webhook')
export class LinkedinUnipileWebhookController {
  private readonly logger = new Logger(LinkedinUnipileWebhookController.name);

  // Unipile configuration - These should come from environment variables
  private readonly unipileApiUrl = process.env.UNIPILE_API_URL || 'https://api18.unipile.com:14823';
  private readonly unipileAccessToken = process.env.UNIPILE_ACCESS_TOKEN || 'jzS7Uh0w.rfsm3/s0r5zinYIGCmQ0bOSo2PS4UWtXBKMCY5xG4Lw=';


  constructor(private readonly webhookService: UnipileWebhookService) {
    if (!this.unipileAccessToken) {
      this.logger.warn('UNIPILE_ACCESS_TOKEN not found in environment variables');
    }
  }


  /**
   * Main webhook endpoint for all Unipile webhook types
   * This endpoint handles: account status, new messages, emails, tracking, and relations
   * Note: This endpoint is not protected by JwtAuthGuard as it's called by Unipile servers
   */
  @Post('webhook')
  async handleUnipileWebhook(
    @Body() payload: UnipileWebhookPayload,
    @Req() request: any,
    @Res() response: any,
  ) {
    try {
      this.logger.log('Received Unipile webhook');

      // Validate webhook authentication if Unipile-Auth header is present
      const unipileAuth = request.headers['unipile-auth'];
      if (unipileAuth && !this.webhookService.validateWebhookAuth(unipileAuth)) {
        return response.status(401).json({
          success: false,
          message: 'Unauthorized webhook request',
        });
      }

      // Process webhook using the dedicated service
      await this.webhookService.processWebhook(payload);

      // Return 200 status within 30 seconds as required by Unipile
      return response.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to process Unipile webhook:', error);
      return response.status(500).json({
        success: false,
        message: 'Failed to process webhook',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

}






// curl --request POST \
// --url https://api18.unipile.com:14823/api/v1/webhooks \
// --header 'X-API-KEY: jzS7Uh0w.rfsm3/s0r5zinYIGCmQ0bOSo2PS4UWtXBKMCY5xG4Lw=' \
// --header 'accept: application/json' \
// --header 'content-type: application/json' \
// --data '{
// "request_url": "https://51dh0t1p-3000.inc1.devtunnels.ms/linkedin-unipile/webhook",
// "source": "messaging",
// "headers": [
// {
//  "key": "Content-Type",
//  "value": "application/json"
// },
// {
//  "key": "Unipile-Auth",
//  "value": "ACoAAAcDMMQBODyLwZrRcgYhrkCafURGqva0U4E"
// }
// ]
// }'