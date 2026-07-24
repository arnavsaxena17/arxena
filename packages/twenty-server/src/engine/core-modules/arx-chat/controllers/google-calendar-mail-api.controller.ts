import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import moment from 'moment-timezone';
import { Job, PersonNode } from 'twenty-shared';

import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { CalendarEmailService } from 'src/engine/core-modules/arx-chat/utils/calendar-email';
import { SendEmailFunctionality } from 'src/engine/core-modules/arx-chat/utils/send-gmail';
import { CalendarEventType } from 'src/engine/core-modules/calendar-events/services/calendar-data-objects-types';
import { CandidateWorkspaceGraphQLService } from 'src/engine/core-modules/candidate-sourcing/services/candidate-workspace-graphql.service';
import { EmailService } from 'src/engine/core-modules/email/email.service';
import { GmailMessageData } from 'src/engine/core-modules/gmail-sender/services/gmail-sender-objects-types';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

type DraftSavedEmailProps = {
  firstName: string;
  subject: string;
  attachmentCount: number;
  locale?: string;
};

function DraftSavedEmail({
  firstName,
  subject,
  attachmentCount,
  locale = 'en',
}: DraftSavedEmailProps): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1D4ED8">Email Draft Saved Successfully</h2>
      <p style="font-size: 16px; line-height: 1.5">
        Hello ${firstName},
      </p>
      <p style="font-size: 16px; line-height: 1.5">
        Your email draft has been successfully saved with the following details:
      </p>
      <ul style="font-size: 16px; line-height: 1.5">
        <li>Subject: ${subject}</li>
        <li>Attachments: ${attachmentCount} file${attachmentCount !== 1 ? 's' : ''}</li>
      </ul>
      <p style="font-size: 16px; line-height: 1.5">
        You can find this draft in your email drafts folder. Feel free to review and send it when you're ready.
      </p>
      <p style="font-size: 16px; line-height: 1.5">
        Best regards,<br />
        The Arxena Team
      </p>
    </div>
  `;
}

@Controller('gmail-calendar-contacts')
export class GoogleControllers {
  private fixAttachmentUrl(url: string): string {
    // Handle local file paths
    if (url.includes('/home/ubuntu/')) {
      return url; // Return as is for local file paths
    }
    
    // Fix double slashes in URL (but preserve protocol://)
    url = url.replace(/([^:])\/+/g, '$1/');
    
    // Remove duplicate token parameters
    if (url.includes('?token=')) {
      const baseUrl = url.split('?token=')[0];
      const firstToken = url.split('?token=')[1].split('?token=')[0];
      return `${baseUrl}?token=${firstToken}`;
    }
    return url;
  }

  private async getAttachmentContent(path: string): Promise<Buffer | undefined> {
    const fs = require('fs').promises;
    try {
      if (path.startsWith('http')) {
        // For web URLs, let the SMTP driver handle the download
        return undefined;
      } else {
        // For local files, read directly
        return await fs.readFile(path);
      }
    } catch (error) {
      console.error(`Failed to read attachment: ${error.message}`);
      return undefined;
    }
  }

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly emailService: EmailService,
    private readonly candidateWorkspaceGraphQLService: CandidateWorkspaceGraphQLService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  @Get('calendar-events')
  @UseGuards(JwtAuthGuard)
  async getCalendarEvents(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    try {
      // Optional query parameters for time range
      const timeMin = request.query.timeMin || new Date().toISOString(); // Default to current time
      const timeMax =
        request.query.timeMax || moment().add(7, 'days').toISOString(); // Default to 7 days ahead

      const calendarParams = {
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
      };

      const response = await new CalendarEmailService().getCalendarEvents(
        calendarParams,
        apiToken,
      );

      return response || {};
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw error;
    }
  }

  @Post('send-test-email-using-local-email-service')
  @UseGuards(JwtAuthGuard)
  async sendTestEmail(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    console.log('API TOKEN BUT WILL NOT USE IT:', apiToken);
    try {
      console.log('Have hit test email');

      console.log('SMTP Settings:', {
        host: process.env.EMAIL_SMTP_HOST,
        port: process.env.EMAIL_SMTP_PORT,
        auth: {
          user: process.env.EMAIL_SMTP_USER,
          pass: process.env.EMAIL_SMTP_PASSWORD,
        },
      });

      const result = await this.emailService.send({
        from: '"Arnav Saxena" <arnav@arxena.com>',
        to: 'arnavsaxena17@gmail.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<h1>Test Email</h1><p>This is a test email</p>',
      });

      console.log('Email send completed:', result);

      return { message: 'Email sent', result };
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  @Post('send-mail')
  @UseGuards(JwtAuthGuard)
  async sendEmail(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const person: PersonNode | undefined = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
      ).getPersonDetailsByPhoneNumber(request.body.phoneNumber, apiToken);

    if (!person) {
      throw new Error('Person not found');
    }

    const candidateNode = person.candidates.edges[0].node;
    const candidateJob: Job = candidateNode?.jobs;
    const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(
      candidateJob,
      apiToken,
    );
    if (!recruiterProfile) {
      throw new Error('Recruiter profile not found for job');
    }

    console.log('recruiterProfile?.email:', recruiterProfile?.email);
    const emailData: GmailMessageData = {
      sendEmailFrom: recruiterProfile.email,
      sendEmailNameFrom:
        recruiterProfile.firstName + ' ' + recruiterProfile.lastName,
      sendEmailTo: person?.emails.primaryEmail ?? '',
      subject: request.body?.subject || 'Email from the recruiter',
      message: request.body?.message || 'This is a test email',
    };

    console.log('This is the email Data in plain send meial:', emailData);
    const response = await new SendEmailFunctionality().sendEmailFunction(
      emailData,
      apiToken,
    );

    console.log('This is the response. insend meail:', response);

    return response || {}; // Return an empty object if the response is undefined
  }

  @Post('send-mail-with-attachment')
  @UseGuards(JwtAuthGuard)
  async sendEmailWithAttachment(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    
    const person: PersonNode | undefined = await new FilterCandidates(
    this.workspaceQueryService,
    this.staticGraphQLService,
    ).getPersonDetailsByPhoneNumber(request.body.phoneNumber, apiToken);

    if (!person) {
      throw new Error('Person not found');
    }

    const candidateNode = person.candidates.edges[0].node;
    const candidateJob: Job = candidateNode?.jobs;
    const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(
      candidateJob,
      apiToken,
    );
    if (!recruiterProfile) {
      throw new Error('Recruiter profile not found for job');
    }

    const emailData: GmailMessageData = {
      sendEmailFrom: recruiterProfile.email,
      sendEmailNameFrom:
        recruiterProfile.firstName + ' ' + recruiterProfile.lastName,
      sendEmailTo: person?.emails.primaryEmail ?? '',
      subject: request.body?.subject || 'Email from the recruiter',
      message: request.body?.message || 'This is a test email',
      attachments: request.body.attachments || [],
    };

    console.log('This si the email data to send attachemnts:', emailData);

    const response =
      await new SendEmailFunctionality().sendEmailWithAttachmentFunction(
        emailData,
        apiToken,
      );

    return response || {};
  }

  @Post('save-draft-mail-with-attachment')
  @UseGuards(JwtAuthGuard)
  async saveDraftEmailWithAttachments(@Req() request: any): Promise<object> {
    console.log('saveDraftEmailWithAttachments');
    const apiToken = request.headers.authorization.split(' ')[1];
    const candidateId = request.body.candidateId;
    console.log('This is the candidateId:', candidateId);
    let person: PersonNode;
    const candidateIds = [candidateId];
    const jobIds = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
      ).getJobIdsFromCandidateIds(candidateIds, apiToken);
    console.log('This is the jobIds:', jobIds);

    const candidateJob: Job = await this.candidateWorkspaceGraphQLService.getJobDetails(
      jobIds[0] || '',
      '',
      apiToken,
    );

    console.log('This is the candidate job name:', candidateJob.name);
    const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(
      candidateJob,
      apiToken,
    );
    if (!recruiterProfile) {
      throw new Error('Recruiter profile not found for job');
    }
    const emailData: GmailMessageData = {
      sendEmailFrom: recruiterProfile.email,
      sendEmailNameFrom:
        recruiterProfile.firstName + ' ' + recruiterProfile.lastName,
      sendEmailTo: recruiterProfile.email,
      subject: request.body?.subject || 'Email from the recruiter',
      message: request.body?.message || 'This is a test email',
      attachments: request.body.attachments || [],
    };

    console.log('This si the email data to save drafts:', emailData);
    
    // const response =
    //   await new SendEmailFunctionality().saveDraftEmailWithAttachmentsFunction(
    //     emailData,
    //     apiToken,
    //   );

    // Send notification email
    const emailTemplate = DraftSavedEmail({
      firstName: recruiterProfile.firstName,
      subject: emailData.subject,
      attachmentCount: (emailData.attachments || []).length,
      locale: 'en',
    });

    // Convert GmailMessageData attachments to nodemailer attachments
    const attachments = await Promise.all((emailData.attachments || []).map(async attachment => {
      const fixedPath = this.fixAttachmentUrl(attachment.path);
      const content = await this.getAttachmentContent(fixedPath);
      
      return {
        filename: attachment.filename,
        path: content ? undefined : fixedPath, // Use path only if content is not available
        content, // Use content if available
      };
    }));

    try {
      console.log('Sending email to recruiter profile:', recruiterProfile.email);
      await this.emailService.send({
        from: `Arxena <${process.env.EMAIL_FROM_ADDRESS || 'no-reply@arxena.com'}>`,
        to: recruiterProfile.email,
        subject: 'Candidate Shortlist and Documentation',
        html: emailTemplate,
        text: emailTemplate.replace(/<[^>]*>/g, ''),
        attachments: attachments.filter(a => a.content || a.path), // Filter out failed attachments
      });
      return { status: 'Email draft saved successfully' };
    } catch (error) {
      console.error('Error sending email:', error);
      if (error.responseCode === 421) {
        return {
          status: 'error',
          error: 'Gmail rate limit exceeded. Please try again in a few minutes.',
          details: error.message
        };
      }
      return { 
        status: 'error',
        error: error.message,
        details: 'Failed to send notification email'
      };
    }
  }

  @Post('send-mail-to-self')
  @UseGuards(JwtAuthGuard)
  async sendEmailToSelf(@Req() request: any): Promise<object> {
    console.log('sendEmailToSelf');
    const apiToken = request.headers.authorization.split(' ')[1];
    const origin = request.headers.origin;
    console.log('origin', origin);
    const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileFromCurrentUser(apiToken, origin);
    console.log('recruiterProfile', recruiterProfile);
    const emailData: GmailMessageData = {
      sendEmailFrom: recruiterProfile?.email,
      sendEmailTo: recruiterProfile?.email,
      sendEmailNameFrom:
        recruiterProfile?.firstName + ' ' + recruiterProfile?.lastName,
      subject: request.body?.subject || 'Email from the recruiter',
      message: request.body?.message || 'This is a test email',
      attachments: request.body.attachments || [],
    };
    console.log('emailData', emailData);
    console.log(
      'This si the email data to send attachemnts in the send email to self:',
      emailData,
    );
    const response =
      await new SendEmailFunctionality().sendEmailWithAttachmentFunction(
        emailData,
        apiToken,
      );
    console.log('response', response);
    return response || {};
  }

  @Post('send-calendar-invite')
  @UseGuards(JwtAuthGuard)
  async sendCalendarInvite(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const person: PersonNode | undefined = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getPersonDetailsByPhoneNumber(request.body.phoneNumber, apiToken);
    const gptInputs = request.body;

    const convertToUTC = (dateTime: string, timeZone: string): string => {
      if (!dateTime) {
        // If no datetime provided, use tomorrow's date
        return moment.tz(timeZone).add(1, 'day').utc().format();
      }

      return moment.tz(dateTime, timeZone).utc().format();
    };
    const timeZone = gptInputs?.timeZone || 'Asia/Kolkata';
    // Convert start and end times to UTC
    const defaultStart = moment.tz(timeZone).add(1, 'day').hour(13).minute(30);
    const defaultEnd = moment(defaultStart).add(2, 'hours');

    console.log(
      'This is default start',
      defaultStart.format('YYYY-MM-DDTHH:mm:ss'),
    );
    console.log(
      'This is default end',
      defaultEnd.format('YYYY-MM-DDTHH:mm:ss'),
    );

    const startTimeUTC = convertToUTC(
      gptInputs?.startDateTime || defaultStart.format('YYYY-MM-DDTHH:mm:ss'),
      timeZone,
    );
    const endTimeUTC = convertToUTC(
      gptInputs?.endDateTime || defaultEnd.format('YYYY-MM-DDTHH:mm:ss'),
      timeZone,
    );

    console.log('This is the start time:', startTimeUTC);
    console.log('This is the endTimeUTC:', endTimeUTC);

    if (!person) {
      throw new Error('Person not found');
    }

    const candidateNode = person.candidates.edges[0].node;
    const candidateJob: Job = candidateNode?.jobs;
    const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(
      candidateJob,
      apiToken,
    );
    if (!recruiterProfile) {
      throw new Error('Recruiter profile not found for job');
    }

    // const recruiterProfile = await getRecruiterProfileFromCurrentUser(apiToken)

    console.log('Function Called: scheduleMeeting');
    const calendarEventObj: CalendarEventType = {
      summary:
        person.name.firstName +
          ' ' +
          person.name.lastName +
          ' <> ' +
          recruiterProfile.firstName +
          ' ' +
          recruiterProfile.lastName || gptInputs?.summary,
      typeOfMeeting: gptInputs?.typeOfMeeting || 'Virtual',
      location: gptInputs?.location || 'Google Meet',
      description:
        gptInputs?.description ||
        'This meeting is scheduled to discuss the candidate and the job.',
      start: {
        dateTime: startTimeUTC,
        timeZone: timeZone,
      },
      end: {
        dateTime: endTimeUTC,
        timeZone: timeZone,
      },
      attendees: [
        { email: person.emails.primaryEmail, responseStatus: 'accepted' },
        { email: recruiterProfile.email, responseStatus: 'accepted' },
      ].filter((attendee) => Boolean(attendee.email?.trim())),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'email', minutes: 15 },
          { method: 'popup', minutes: 10 },
        ],
      },
    };
    const response = await new CalendarEmailService().createNewCalendarEvent(
      calendarEventObj,
      apiToken,
    );

    return { status: 'scheduleMeeting the candidate meeting.' };
  }
}
