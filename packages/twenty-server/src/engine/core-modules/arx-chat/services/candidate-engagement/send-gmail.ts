import axios from "axios";
import { GmailMessageData } from "../../../gmail-sender/services/gmail-sender-objects-types";
import { MailerController } from "../../../gmail-sender/gmail-sender.controller";
import { MailerService } from "../../../gmail-sender/gmail-sender.service";

export class SendEmailFunctionality {
  async sendEmailFunction(gmailMessageData: GmailMessageData) {
    // Create a new calendar event
    const mailerService = new MailerService();
    const mailerController = new MailerController(mailerService);
    await mailerController
      .sendEmailOfController(gmailMessageData)
      .catch(console.error);
    // console.log("This is the response from the calendar event creation", calendarEventResponse.data);
  }
}
