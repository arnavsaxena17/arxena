import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
  Res,
} from '@nestjs/common';

import { Request, Response } from 'express';

import { SupportChatOrchestratorService } from 'src/modules/support-chat/services/support-chat-orchestrator.service';

@Controller('support-chat')
export class SupportChatController {
  constructor(
    private readonly supportChatOrchestratorService: SupportChatOrchestratorService,
  ) {}

  @Post('bootstrap')
  @HttpCode(200)
  async bootstrap() {
    return this.supportChatOrchestratorService.getBootstrapPayload();
  }

  @Post('handoff')
  @HttpCode(200)
  async handoff(
    @Body()
    body: {
      conversationId?: number | string;
      reason?: string;
    },
  ) {
    return this.supportChatOrchestratorService.markConversationForHandoff(
      String(body.conversationId ?? ''),
      body.reason ?? 'manual-handoff',
    );
  }

  @Post('chatwoot/webhooks')
  async handleChatwootWebhook(
    @Headers('x-chatwoot-signature') signature: string | undefined,
    @Headers('x-chatwoot-timestamp') timestamp: string | undefined,
    @Headers('x-chatwoot-delivery') deliveryId: string | undefined,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    if (!req.rawBody) {
      res.status(400).json({ ok: false, error: 'Missing raw body' });
      return;
    }

    try {
      const result =
        await this.supportChatOrchestratorService.handleWebhookPayload({
          signature,
          timestamp,
          deliveryId,
          rawBody: req.rawBody,
        });

      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Webhook failed',
      });
    }
  }
}
