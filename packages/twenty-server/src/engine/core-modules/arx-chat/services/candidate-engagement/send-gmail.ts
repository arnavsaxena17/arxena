import axios from "axios";
import { GmailMessageData } from "../../../gmail-sender/services/gmail-sender-objects-types";
import { MailerController } from "../../../gmail-sender/gmail-sender.controller";
import { MailerService } from "../../../gmail-sender/gmail-sender.service";
import * as allDataObjects from '../data-model-objects';

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


export class EmailTemplates{

  async getInterviewInvitationTemplate(person: allDataObjects.PersonNode,interviewLink: string) {
    console.log("Goign to try and create template")
    const template = `
      <div>
        <p>Dear ${person?.name?.firstName},</p>
        
        <p>We have reviewed your profile and would like to invite you for a video interview for the position of <b>${person?.candidates?.edges[0].node.jobs.name}</b> at <b>${person.candidates.edges[0].node.jobs?.companies?.name}</b>.</p>

        <p><strong>Interview Details:</strong></p>
        <p>Interview Link: ${process.env.FRONT_BASE_URL+ interviewLink}</p>
        <p>Note: Link expires in 48 hours</p>
        
        <p><strong>Instructions:</strong></p>
        <ol>
          <li>Complete the interview within 48 hours of receiving this email</li>
          <li>You will be presented with 3 timed questions</li>
          <li>Record your response to each question (4-minute limit per response)</li>
          <li>Ensure you have:
            <ul>
              <li>A quiet environment</li>
              <li>Good lighting</li>
              <li>Stable internet connection</li>
              <li>Desktop computer/Laptop (preferred)</li>
            </ul>
          </li>
        </ol>
  
        <p>Best regards,<br>
        Arnav Saxena<br>
        Director, Arxena</p>
      </div>
    `;
    return template;
  }
}