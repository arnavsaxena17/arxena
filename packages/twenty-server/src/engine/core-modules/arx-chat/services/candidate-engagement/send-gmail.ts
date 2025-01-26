import { GmailMessageData } from "../../../gmail-sender/services/gmail-sender-objects-types";
import { GmailSender } from "../../../gmail-sender/gmail-sender"
import { MailerService } from "../../../gmail-sender/gmail-sender.service";
import * as allDataObjects from '../data-model-objects';

export class SendEmailFunctionality {
  async sendEmailFunction(gmailMessageData: GmailMessageData, twenty_token: string) {
    // Create a new calendar event
    const mailerService = new MailerService();
    const gmailSender = new GmailSender(mailerService);
    const response = await gmailSender.sendEmailOfController(gmailMessageData, twenty_token).catch(console.error);
    console.log("Response from sendEmailFunction", response); 
    return response;
  }
  async sendEmailWithAttachmentFunction(gmailMessageData: GmailMessageData, twenty_token: string) {
    const mailerService = new MailerService();
    const gmailSender = new GmailSender(mailerService);
    const response = await gmailSender.sendEmailWithAttachmentsController(gmailMessageData, twenty_token).catch(console.error);
    return response;
  }
  async saveDraftEmailWithAttachmentsFunction(gmailMessageData: GmailMessageData, twenty_token: string) {
    const mailerService = new MailerService();
    const gmailSender = new GmailSender(mailerService);
    const response = await gmailSender.saveDraftEmailWithAttachmentsController(gmailMessageData, twenty_token).catch(console.error);
    return response;
  }
}


export class EmailTemplates{

  async getInterviewInvitationTemplate(person: allDataObjects.PersonNode,candidateJob:allDataObjects.Jobs, interviewLink: string) {
    console.log("Goign to try and create template")
    const candidate = person?.candidates?.edges?.find(edge => edge.node.jobs.id === candidateJob.id)?.node;
    const jobName = candidate?.jobs.name;
    const companyName = candidate?.jobs.company.name;

    const template = `
      <div>
        <p>Dear ${person?.name?.firstName},</p>
        
        <p>We have reviewed your profile and would like to invite you for a video interview for the position of <b>${jobName}</b> at <b>${companyName}</b>.</p>

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