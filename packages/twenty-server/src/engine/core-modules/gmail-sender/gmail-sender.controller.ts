import { Controller, Post, Body, Get } from "@nestjs/common";
import { MailerService } from "./gmail-sender.service";
import * as gmailSenderTypes from "./services/gmail-sender-objects-types";

@Controller("gmail-sender")
export class MailerController {
  constructor(private readonly mailerService: MailerService) {}

  @Get("sendMail")
  async sendEmailOfController(
    gmailMessageObject: gmailSenderTypes.GmailMessageData
  ): Promise<object> {
    try {
      const auth = await this.mailerService.authorize();
      await this.mailerService.sendMails(auth, gmailMessageObject);
      return { status: "Event created successfully" };
    } catch (error) {
      console.error("Error creating event: ", error);
      return { status: "Error creating event", error: error.message };
    }
  }
}
