import {  Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import twilio from 'twilio';

@Controller('twilio')
export class TwilioControllers {

  @Post('sendMessage')
  @UseGuards(JwtAuthGuard)
  async sendMessage(@Req() request: any): Promise<object> {
    console.log('going to send twilio message');
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure

    const template =
      "Hi {1},\n\nI'm {2}, {3} at {4}, a {5}.\n\nI'm hiring for a {6} role based out of {7} and got your application my job posting. I believe this might be a good fit.\n\nWanted to speak to you in regards your interests in our new role. Would you be available for a short call sometime tomorrow?";

    // Variables to replace placeholders
    const variables = {
      1: 'Anjali', // {1}
      2: 'Arnav', // {2}
      3: 'Director', // {3}
      4: 'Arxena', // {4}
      5: 'US based recruitment agency', // {5}
      6: 'HR Head', // {6}
      7: 'Surat', // {7}
    };

    const recruitingTemplate = 'Hi {{1}}, are you interested in a new job?';
    const recruitingTemplate2 = 'Hello, are you interested in a new job?';
    const recruitingVariables = {
      1: 'Rahul',
    };

    // Replace placeholders with actual values
    let body = template;
    let replacementVariables = variables;
    for (const [key, value] of Object.entries(replacementVariables)) {
      body = body.replace(`{${key}}`, value);
    }
    console.log('This is body', body);

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = twilio(accountSid, authToken);
    console.log('Client created');
    const message = await client.messages.create({
      body: body,
      from: 'whatsapp:+15153163273',
      to: 'whatsapp:+919601277382',
    });
    console.log('This is mesage body:', message.body);

    return message;
  }

  @Post('testMessage')
  @UseGuards(JwtAuthGuard)
  async testMessage(@Req() request: any): Promise<any> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = require('twilio')(accountSid, authToken);

    client.messages.create({
        body: 'Hi, would you be keen on a new role?',
        from: 'whatsapp:+15153163273',
        to: 'whatsapp:+918411937769',
      }).then(message => console.log(message.sid)).done();
  }
  
}



