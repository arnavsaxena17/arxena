import { Controller, Get, Post, Req, Res } from '@nestjs/common';

import { VoiceCallService } from 'src/engine/core-modules/arx-chat/services/voice-call/voice-call.service';
import { IncomingWhatsappMessages } from 'src/engine/core-modules/arx-chat/services/whatsapp-api/incoming-messages';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

@Controller('webhook')
export class WhatsappWebhook {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly voiceCallService: VoiceCallService,
    @InjectMessageQueue(MessageQueue.engagedCandidateProcessingQueue) private readonly messageQueueService?: MessageQueueService,
  ) {}

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

    const value = requestBody?.entry?.[0]?.changes?.[0]?.value;
    const calls = value?.calls;
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

    try {
      await new IncomingWhatsappMessages(
        this.workspaceQueryService,
        this.staticGraphQLService,
        this.messageQueueService,
      ).receiveIncomingMessagesFromFacebook(requestBody, requestBody?.entry[0]?.changes[0]?.value?.messages[0]);
    } catch (error) {
      // Handle error
    }
    console.log('Response 200 sent to whatsapp webhook for message:');
    response.sendStatus(200);
  }
}
