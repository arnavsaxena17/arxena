import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import * as allDataObjects from '../services/data-model-objects';
import { UpdateChat } from '../services/candidate-engagement/update-chat';
import { GmailMessageData } from '../../gmail-sender/services/gmail-sender-objects-types';
import { SendEmailFunctionality, EmailTemplates } from '../utils/send-gmail';
import { CalendarEventType } from '../../calendar-events/services/calendar-data-objects-types';
import { CalendarEmailService } from '../utils/calendar-email';
import moment from 'moment-timezone';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { EmailService } from 'src/engine/integrations/email/email.service';
import { FilterCandidates } from '../services/candidate-engagement/filter-candidates';
import { getRecruiterProfileByJob, getRecruiterProfileFromCurrentUser } from '../services/recruiter-profile';


@Controller('google-mail-calendar-contacts')
export class GoogleControllers {

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly emailService: EmailService
  ) {}


@Get('calendar-events')
@UseGuards(JwtAuthGuard)
async getCalendarEvents(@Req() request: any): Promise<object> {
  const apiToken = request.headers.authorization.split(' ')[1];
  
  try {
    // Optional query parameters for time range
    const timeMin = request.query.timeMin || new Date().toISOString(); // Default to current time
    const timeMax = request.query.timeMax || moment().add(7, 'days').toISOString(); // Default to 7 days ahead
    
    const calendarParams = {
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime'
    };
    
    const response = await new CalendarEmailService().getCalendarEvents(calendarParams, apiToken);
    return response || {};
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    throw error;
  }
}


  @Post('send-test-email-using-local-email-service')
  @UseGuards(JwtAuthGuard)
  async sendTestEmail(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    console.log("API TOKEN BUT WILL NOT USE IT:", apiToken);
    try {
      console.log("Have hit test email");

      console.log("SMTP Settings:", {
        host: process.env.EMAIL_SMTP_HOST,
        port: process.env.EMAIL_SMTP_PORT,
        auth: {
          user: process.env.EMAIL_SMTP_USER,
          pass: process.env.EMAIL_SMTP_PASSWORD
        }
      });
      

      
      const result = await this.emailService.send({
        from: '"Arnav Saxena" <arnav@arxena.com>',
        to: 'arnavsaxena17@gmail.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<h1>Test Email</h1><p>This is a test email</p>',
      });
      
      console.log("Email send completed:", result);
      return { message: 'Email sent', result };
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  }





  @Post('send-mail')
  @UseGuards(JwtAuthGuard)
  async sendEmail(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const person: allDataObjects.PersonNode = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumber,apiToken);

    const candidateNode = person.candidates.edges[0].node;
    const candidateJob:allDataObjects.Jobs = candidateNode?.jobs;
    const recruiterProfile = await getRecruiterProfileByJob(candidateJob, apiToken) 

    console.log("recruiterProfile?.email:", recruiterProfile?.email)
    const emailData: GmailMessageData = {
      sendEmailFrom: recruiterProfile?.email,
      sendEmailNameFrom: recruiterProfile?.firstName + ' ' + recruiterProfile?.lastName,
      sendEmailTo: person?.email,
      subject: request.body?.subject || 'Email from the recruiter',
      message: request.body?.message || 'This is a test email',
    };
    console.log("This is the email Data in plain send meial:", emailData)
    const response = await new SendEmailFunctionality().sendEmailFunction(emailData, apiToken);
    console.log("This is the response. insend meail:", response)
    return response || {}; // Return an empty object if the response is undefined
  }

  @Post('send-mail-with-attachment')
  @UseGuards(JwtAuthGuard)
  async sendEmailWithAttachment(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const person: allDataObjects.PersonNode = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumber,apiToken);
    
    const candidateNode = person.candidates.edges[0].node;
    const candidateJob:allDataObjects.Jobs = candidateNode?.jobs;
    const recruiterProfile = await getRecruiterProfileByJob(candidateJob, apiToken) 

    
    const emailData: GmailMessageData = {
      sendEmailFrom: recruiterProfile?.email,
      sendEmailNameFrom: recruiterProfile?.firstName + ' ' + recruiterProfile?.lastName,
      sendEmailTo: person?.email,
      subject: request.body?.subject || 'Email from the recruiter',
      message: request.body?.message || 'This is a test email',
      attachments: request.body.attachments || [],
    };
    console.log("This si the email data to send attachemnts:", emailData)

    const response = await new SendEmailFunctionality().sendEmailWithAttachmentFunction(emailData, apiToken);
    return response || {};
  }
  @Post('save-draft-mail-with-attachment')
  @UseGuards(JwtAuthGuard)
  async saveDraftEmailWithAttachments (@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    const person: allDataObjects.PersonNode = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumber,apiToken);
    const candidateNode = person.candidates.edges[0].node;
    const candidateJob:allDataObjects.Jobs = candidateNode?.jobs;
    const recruiterProfile = await getRecruiterProfileByJob(candidateJob, apiToken) 
    const emailData: GmailMessageData = {
      sendEmailFrom: recruiterProfile?.email,
      sendEmailNameFrom: recruiterProfile?.firstName + ' ' + recruiterProfile?.lastName,
      sendEmailTo: person?.email,
      subject: request.body?.subject || 'Email from the recruiter',
      message: request.body?.message || 'This is a test email',
      attachments: request.body.attachments || [],
    };
    console.log("This si the email data to save drafts:", emailData)
    const response = await new SendEmailFunctionality().saveDraftEmailWithAttachmentsFunction(emailData, apiToken);
    return response || {};
  }

  @Post('send-mail-to-self')
  @UseGuards(JwtAuthGuard)
  async sendEmailToSelf(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];



    const recruiterProfile = await getRecruiterProfileFromCurrentUser(apiToken)
    // const candidateJob:allDataObjects.Jobs = candidateNode?.jobs;
    const emailData: GmailMessageData = {
      sendEmailFrom: recruiterProfile?.email,
      sendEmailTo: recruiterProfile?.email,
      sendEmailNameFrom: recruiterProfile?.firstName + ' ' + recruiterProfile?.lastName,
      subject: request.body?.subject || 'Email from the recruiter',
      message: request.body?.message || 'This is a test email',
      attachments: request.body.attachments || [],
    };
    console.log("This si the email data to send attachemnts in the send email to self:", emailData)
    const response = await new SendEmailFunctionality().sendEmailWithAttachmentFunction(emailData, apiToken);
    return response || {};
  }

  @Post('send-calendar-invite')
  @UseGuards(JwtAuthGuard)
  async sendCalendarInvite(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const person: allDataObjects.PersonNode = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumber,apiToken);
    const gptInputs = request.body;

    const convertToUTC = (dateTime: string, timeZone: string): string => {
      if (!dateTime) {
          // If no datetime provided, use tomorrow's date
          return moment.tz(timeZone).add(1, 'day').utc().format();
      }
      return moment.tz(dateTime, timeZone).utc().format();
    };
    const timeZone = gptInputs?.timeZone || "Asia/Kolkata";
    // Convert start and end times to UTC
    const defaultStart = moment.tz(timeZone).add(1, 'day').hour(13).minute(30);
    const defaultEnd = moment(defaultStart).add(2, 'hours');
    console.log("This is default start", defaultStart.format('YYYY-MM-DDTHH:mm:ss'))
    console.log("This is default end", defaultEnd.format('YYYY-MM-DDTHH:mm:ss'))
    

    const startTimeUTC = convertToUTC(gptInputs?.startDateTime || defaultStart.format('YYYY-MM-DDTHH:mm:ss'), timeZone);
    const endTimeUTC = convertToUTC(gptInputs?.endDateTime || defaultEnd.format('YYYY-MM-DDTHH:mm:ss'), timeZone);

    console.log("This is the start time:", startTimeUTC)
    console.log("This is the endTimeUTC:", endTimeUTC)

    const candidateNode = person.candidates.edges[0].node;
    const candidateJob:allDataObjects.Jobs = candidateNode?.jobs;
    const recruiterProfile = await getRecruiterProfileByJob(candidateJob, apiToken) 

    // const recruiterProfile = await getRecruiterProfileFromCurrentUser(apiToken)

    console.log('Function Called: scheduleMeeting');
    const calendarEventObj: CalendarEventType = {
      summary: person.name.firstName + ' ' + person.name.lastName + ' <> ' + recruiterProfile.firstName + ' ' + recruiterProfile.lastName ||  gptInputs?.summary,
      typeOfMeeting: gptInputs?.typeOfMeeting || 'Virtual',
      location: gptInputs?.location || 'Google Meet',
      description: gptInputs?.description || 'This meeting is scheduled to discuss the role and the company.',
      start: { 
        dateTime: startTimeUTC,
        timeZone: timeZone
      },
      end: { 
        dateTime: endTimeUTC,
        timeZone: timeZone
      },
      attendees: [{ email: person.email }, { email: recruiterProfile.email }],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'email', minutes: 15 },
          { method: 'popup', minutes: 10 },
        ],
      },
    };
    const response = await new CalendarEmailService().createNewCalendarEvent(calendarEventObj, apiToken);
    console.log("Response data:", (response as any)?.data)
    return { status: 'scheduleMeeting the candidate meeting.' };
  }
}


