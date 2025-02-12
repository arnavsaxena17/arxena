import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { IncomingWhatsappMessages } from '../services/whatsapp-api/incoming-messages';
import { EnvironmentService } from 'src/engine/integrations/environment/environment.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

@Controller('webhook')
export class WhatsappWebhook {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly environmentService: EnvironmentService,
  ) {}

  @Get()
  findAll(@Req() request: any, @Res() response: any) {
    console.log('-------------- New Request GET --------------');
    var mode = request.query['hub.mode'];
    var token = request.query['hub.verify_token'];
    var challenge = request.query['hub.challenge'];
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
    console.log('Body from POST REQUEST:' + JSON.stringify(request.body, null, 3));
    // const apiToken = request.headers.authorization.split(' ')[1];

    const requestBody = request.body;
    console.log('Request Body::', requestBody);
    try {
      const userMessageBodyFrom = requestBody?.entry[0]?.changes[0]?.value?.messages[0]?.from || '';
      console.log('UserMessageBodyFrom::', userMessageBodyFrom);
      if (userMessageBodyFrom === '1234567890') {
      console.log('This is a cron test to check if the connection exists or not');
      return;
      }
    } catch (error) {
      console.log('Incoming message could be utility messages:');
    }

    try {
      await new IncomingWhatsappMessages(this.workspaceQueryService).receiveIncomingMessagesFromFacebook(requestBody);
    } catch (error) {
      // Handle error
    }
    response.sendStatus(200);
  }
}
