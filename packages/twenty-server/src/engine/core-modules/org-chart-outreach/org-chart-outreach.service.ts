import { BadRequestException, Injectable } from '@nestjs/common';
import { Job } from 'twenty-shared';

import { LinkedinUnipileMessagingService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile/linkedin-unipile-messaging.service';
import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { WhatsappOutboundRateLimiterService } from 'src/engine/core-modules/arx-chat/services/whatsapp-unipile/whatsapp-outbound-rate-limiter.service';
import { WhatsappUnipileMessagingService } from 'src/engine/core-modules/arx-chat/services/whatsapp-unipile/whatsapp-unipile-messaging.service';
import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';
import { SendEmailFunctionality } from 'src/engine/core-modules/arx-chat/utils/send-gmail';
import { CandidateWorkspaceGraphQLService } from 'src/engine/core-modules/candidate-sourcing/services/candidate-workspace-graphql.service';
import { GoogleContactsService } from 'src/engine/core-modules/google-contacts/google-contacts.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

export type OrgChartOutreachChannel =
  | 'linkedin_invite'
  | 'whatsapp'
  | 'google_contact'
  | 'email';

export type OrgChartOutreachRunParams = {
  channel: OrgChartOutreachChannel;
  jobId?: string;
  message: string;
  templateId?: string;
  linkedinUrl?: string;
  phone?: string;
  email?: string;
  fullName?: string;
  jobTitle?: string;
  companyName?: string;
  subject?: string;
  apiToken: string;
};

@Injectable()
export class OrgChartOutreachService {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    private readonly googleContactsService: GoogleContactsService,
    private readonly candidateWorkspaceGraphQLService: CandidateWorkspaceGraphQLService,
    private readonly whatsappOutboundRateLimiter: WhatsappOutboundRateLimiterService,
  ) {}

  private linkedinMessaging(): LinkedinUnipileMessagingService {
    return new LinkedinUnipileMessagingService(
      this.workspaceQueryService,
      this.staticGraphQLService,
      undefined,
      undefined,
      this.workspaceMemberProfileUnipileService,
    );
  }

  private whatsappMessaging(): WhatsappUnipileMessagingService {
    return new WhatsappUnipileMessagingService(
      this.workspaceQueryService,
      this.staticGraphQLService,
      this.workspaceMemberProfileUnipileService,
      this.whatsappOutboundRateLimiter,
    );
  }

  async run(params: OrgChartOutreachRunParams): Promise<Record<string, unknown>> {
    const jobId = params.jobId?.trim();
    const job =
      jobId && jobId.length > 0
        ? await this.candidateWorkspaceGraphQLService.getJobDetails(
            jobId,
            '',
            params.apiToken,
          )
        : null;
    if (jobId && !job) {
      throw new BadRequestException('Job not found');
    }
    if (!job && params.channel !== 'linkedin_invite') {
      throw new BadRequestException('jobId required');
    }
    const candidateJob = job as Job | null;

    switch (params.channel) {
      case 'linkedin_invite': {
        const linkedinUrl = params.linkedinUrl?.trim();
        if (!linkedinUrl) {
          throw new BadRequestException('linkedinUrl required');
        }
        const result = candidateJob
          ? await this.linkedinMessaging().sendLinkedinInviteForJob(
              params.apiToken,
              candidateJob,
              linkedinUrl,
              params.message,
            )
          : await this.linkedinMessaging().sendLinkedinInviteForWorkspace(
              params.apiToken,
              linkedinUrl,
              params.message,
            );
        if (!result.success) {
          throw new BadRequestException(result.error || 'LinkedIn invite failed');
        }
        return { success: true };
      }
      case 'whatsapp': {
        if (!candidateJob) {
          throw new BadRequestException('jobId required');
        }
        const phone = params.phone?.trim();
        if (!phone) {
          throw new BadRequestException('phone required');
        }
        const result = await this.whatsappMessaging().sendTextToPhoneForJob(
          params.apiToken,
          candidateJob,
          phone,
          params.message,
        );
        if (result.status !== 'success') {
          throw new BadRequestException(result.message || 'WhatsApp send failed');
        }
        return { success: true };
      }
      case 'google_contact': {
        const phone = params.phone?.trim();
        const email = params.email?.trim();
        if (!phone || !email) {
          throw new BadRequestException('phone and email required for Google Contacts');
        }
        const auth = await this.googleContactsService.loadSavedCredentialsIfExist(
          params.apiToken,
        );
        if (!auth) {
          throw new BadRequestException('Google account not connected');
        }
        const existing =
          await this.googleContactsService.getExistingPhoneNumbers(auth);
        if (existing.has(phone)) {
          return {
            success: true,
            skipped: true,
            message: 'Contact with this phone already exists',
          };
        }
        const rawName = (params.fullName || 'Contact').trim();
        const nameParts = rawName.split(/\s+/);
        const givenName = nameParts[0] || 'Contact';
        const familyName = nameParts.slice(1).join(' ') || '';
        await this.googleContactsService.batchCreateContacts(
          auth,
          [
            {
              contactPerson: {
                names: [{ givenName, familyName }],
                phoneNumbers: [{ value: phone, type: 'home' }],
                emailAddresses: [{ value: email }],
                organizations: [
                  {
                    name: params.companyName?.trim() || ' ',
                    title: params.jobTitle?.trim() || ' ',
                  },
                ],
              },
            },
          ],
          'Org chart outreach',
        );
        return { success: true };
      }
      case 'email': {
        if (!candidateJob) {
          throw new BadRequestException('jobId required');
        }
        const to = params.email?.trim();
        if (!to) {
          throw new BadRequestException('email required');
        }
        const recruiterProfile = await new RecruiterProfileService(
          this.staticGraphQLService,
        ).getRecruiterProfileByJob(candidateJob, params.apiToken);
        if (!recruiterProfile?.email) {
          throw new BadRequestException('Recruiter email not found for job');
        }
        const sendEmailNameFrom =
          `${recruiterProfile.firstName ?? ''} ${recruiterProfile.lastName ?? ''}`.trim() ||
          recruiterProfile.name ||
          'Recruiter';
        const emailData = {
          sendEmailFrom: recruiterProfile.email,
          sendEmailNameFrom,
          sendEmailTo: to,
          subject: params.subject?.trim() || 'Message from your recruiter',
          message: params.message,
        };
        await new SendEmailFunctionality().sendEmailFunction(
          emailData,
          params.apiToken,
        );
        return { success: true };
      }
      default:
        throw new BadRequestException('Unknown channel');
    }
  }
}
