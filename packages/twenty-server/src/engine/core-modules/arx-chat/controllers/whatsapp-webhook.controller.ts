import { Controller, Get, Logger, Post, Req, Res } from '@nestjs/common';

import { WorkflowFormWhatsappDecisionService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-form-whatsapp-decision.service';
import { VoiceCallService } from 'src/engine/core-modules/arx-chat/services/voice-call/voice-call.service';
import { IncomingWhatsappMessages } from 'src/engine/core-modules/arx-chat/services/whatsapp-api/incoming-messages';
import { OutreachInboundReplyWindowService } from 'src/engine/core-modules/outreach-command/jobs/outreach-inbound-reply-window.job';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { WhatsappMediaStorageService } from 'src/engine/core-modules/whatsapp-media/services/whatsapp-media-storage.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

@Controller('webhook')
export class WhatsappWebhook {
  private readonly logger = new Logger(WhatsappWebhook.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly voiceCallService: VoiceCallService,
    private readonly whatsappMediaStorageService: WhatsappMediaStorageService,
    private readonly workflowFormWhatsappDecisionService: WorkflowFormWhatsappDecisionService,
    @InjectMessageQueue(MessageQueue.engagedCandidateProcessingQueue) private readonly messageQueueService?: MessageQueueService,
    private readonly gtmInboundReplyWindowService?: OutreachInboundReplyWindowService,
  ) {}

  // Resume pending FORM steps from Official WhatsApp Flow / quick-reply
  private async tryHandleWorkflowFormDecision(
    message: Record<string, unknown> | undefined,
  ): Promise<boolean> {
    if (!message || typeof message !== 'object') {
      return false;
    }

    const interactive = message.interactive as
      | {
          type?: string;
          button_reply?: { id?: string; payload?: string };
          nfm_reply?: { response_json?: string; name?: string };
        }
      | undefined;

    if (!interactive) {
      // Template quick-reply may also arrive as type=button
      if (message.type === 'button') {
        const button = message.button as { payload?: string } | undefined;
        const payload = button?.payload;

        if (typeof payload === 'string') {
          return this.workflowFormWhatsappDecisionService.handleButtonPayload(
            payload,
          );
        }
      }

      return false;
    }

    if (
      interactive.type === 'button_reply' ||
      interactive.type === 'button'
    ) {
      const payload =
        interactive.button_reply?.id ?? interactive.button_reply?.payload;

      if (typeof payload === 'string') {
        return this.workflowFormWhatsappDecisionService.handleButtonPayload(
          payload,
        );
      }
    }

    if (interactive.type === 'nfm_reply') {
      const responseJson = interactive.nfm_reply?.response_json;

      if (typeof responseJson === 'string') {
        return this.workflowFormWhatsappDecisionService.handleFlowResponseJson(
          responseJson,
        );
      }
    }

    return false;
  }

  @Get()
  findAll(@Req() request: any, @Res() response: any) {
    console.log('-------------- New Request GET --------------');
    const mode = request.query['hub.mode'];
    const token = request.query['hub.verify_token'];
    const challenge = request.query['hub.challenge'];

    console.log('Mode:', mode);
    console.log('token:', token);
    console.log('challenge:', challenge);
    console.log('-------------- New Request GET --------------');
    console.log('Headers:' + JSON.stringify(request.headers, null, 3));
    console.log('Body:' + JSON.stringify(request.body, null, 3));

    // Check if a token and mode is in the query string of the request
    if (mode && token) {
      // Check the mode and token sent is correct
      if (mode === 'subscribe' && token === '12345') {
        // Respond with the challenge token from the request
        console.log('WEBHOOK_VERIFIED');
        response.status(200).send(challenge);
      } else {
        console.log('Responding with 403 Forbidden');
        // Respond with '403 Forbidden' if verify tokens do not match
        response.sendStatus(403);
      }
    } else {
      console.log('Replying Thank you.');
      response.json({ message: 'Thank you for the message' });
    }
  }

  @Post()
  async create(@Req() request: any, @Res() response: any) {
    console.log('-------------- New Request POST --------------');
    // console.log('Headers:' + JSON.stringify(request.headers, null, 3));
    console.log(
      'Body from POST REQUEST:' + JSON.stringify(request.body, null, 3),
    );
    // const apiToken = request.headers.authorization.split(' ')[1];

    const requestBody = request.body;

    try {
      const userMessageBodyFrom =
        requestBody?.entry[0]?.changes[0]?.value?.messages[0]?.from || '';

      console.log('UserMessageBodyFrom::', userMessageBodyFrom);
      if (userMessageBodyFrom === '1234567890') {
        console.log(
          'This is a cron test to check if the connection exists or not',
        );

        return;
      }
    } catch (error) {
      console.log('Incoming message could be utility messages:');
    }

    const change = requestBody?.entry?.[0]?.changes?.[0];
    const value = change?.value;
    const webhookField = change?.field;
    const calls = value?.calls;

    // Flow DRAFT/PUBLISHED status webhooks have field=flows and no messages
    if (webhookField === 'flows') {
      this.logger.log(
        `Ignoring WhatsApp flow status webhook: ${value?.event ?? 'unknown'}`,
      );
      response.sendStatus(200);

      return;
    }

    if (Array.isArray(calls) && calls.length > 0) {
      const apiToken =
        (process.env.WHATSAPP_BUSINESS_WEBHOOK_API_TOKEN as string) || null;
      const phoneNumberId = value?.metadata?.phone_number_id;
      for (const call of calls) {
        try {
          await this.voiceCallService.handleWhatsAppBusinessCallEvent(
            {
              phone_number_id: phoneNumberId,
              from: call.from ?? call.caller_id,
              id: call.id,
              timestamp: call.timestamp,
              type: call.type,
              status: call.status,
              duration_seconds: call.duration_seconds ?? call.duration,
            },
            apiToken,
          );
        } catch (err) {
          console.error('WhatsApp webhook call event handling error:', err);
        }
      }
    }

    const hasMessages =
      Array.isArray(value?.messages) && value.messages.length > 0;
    const hasStatuses =
      Array.isArray(value?.statuses) && value.statuses.length > 0;

    if (!hasMessages && !hasStatuses) {
      console.log('Response 200 sent to whatsapp webhook for message:');
      response.sendStatus(200);

      return;
    }

    try {
      const inboundMessage = value?.messages?.[0];

      const handledAsWorkflowForm =
        await this.tryHandleWorkflowFormDecision(inboundMessage);

      if (handledAsWorkflowForm) {
        this.logger.log('Handled inbound WhatsApp as workflow form decision');
        response.sendStatus(200);

        return;
      }

      await new IncomingWhatsappMessages(
        this.workspaceQueryService,
        this.staticGraphQLService,
        this.messageQueueService,
        this.whatsappMediaStorageService,
        this.gtmInboundReplyWindowService,
      ).receiveIncomingMessagesFromFacebook(requestBody, inboundMessage);
    } catch (error) {
      this.logger.error('WhatsApp webhook message handling error', error);
    }
    console.log('Response 200 sent to whatsapp webhook for message:');
    response.sendStatus(200);
  }
}
