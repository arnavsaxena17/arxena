import axios from "axios";
import { GmailMessageData } from "../../../gmail-sender/services/gmail-sender-objects-types";
import { MailerController } from "../../../gmail-sender/gmail-sender.controller";
import { MailerService } from "../../../gmail-sender/gmail-sender.service";

export class SendEmailFunctionality {
  async sendEmailFunction(gmailMessageData: GmailMessageData) {
    // Create a new calendar event
    const mailerService = new MailerService();
    const mailerController = new MailerController(mailerService);
    const response = await mailerController.sendEmailOfController(gmailMessageData).catch(console.error);
    return response;
  }
  async sendEmailWithAttachmentFunction(gmailMessageData: GmailMessageData) {
    const mailerService = new MailerService();
    const mailerController = new MailerController(mailerService);
    const response = await mailerController.sendEmailWithAttachmentsController(gmailMessageData).catch(console.error);
    return response;
  }
  async saveDraftEmailWithAttachmentsFunction(gmailMessageData: GmailMessageData) {
    const mailerService = new MailerService();
    const mailerController = new MailerController(mailerService);
    const response = await mailerController.saveDraftEmailWithAttachmentsController(gmailMessageData).catch(console.error);
    return response;
  }

}
