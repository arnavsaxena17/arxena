import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { WhatsappOutboundRateLimiterService } from 'src/engine/core-modules/arx-chat/services/whatsapp-unipile/whatsapp-outbound-rate-limiter.service';
import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';
import { CandidateWorkspaceGraphQLService } from 'src/engine/core-modules/candidate-sourcing/services/candidate-workspace-graphql.service';
import { GoogleContactsService } from 'src/engine/core-modules/google-contacts/google-contacts.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { OrgChartOutreachService } from './org-chart-outreach.service';

const mockSendLinkedinInviteForJob = jest.fn();
const mockSendTextToPhoneForJob = jest.fn();

jest.mock(
  'src/engine/core-modules/arx-chat/services/linkedin-unipile/linkedin-unipile-messaging.service',
  () => ({
    LinkedinUnipileMessagingService: jest.fn().mockImplementation(() => ({
      sendLinkedinInviteForJob: mockSendLinkedinInviteForJob,
      sendLinkedinInviteForWorkspace: mockSendLinkedinInviteForJob,
    })),
  }),
);

jest.mock(
  'src/engine/core-modules/arx-chat/services/whatsapp-unipile/whatsapp-unipile-messaging.service',
  () => ({
    WhatsappUnipileMessagingService: jest.fn().mockImplementation(() => ({
      sendTextToPhoneForJob: mockSendTextToPhoneForJob,
    })),
  }),
);

jest.mock('src/engine/core-modules/arx-chat/services/recruiter-profile', () => ({
  RecruiterProfileService: jest.fn().mockImplementation(() => ({
    getRecruiterProfileByJob: jest.fn().mockResolvedValue({
      email: 'rec@example.com',
      firstName: 'Rec',
      lastName: 'Ruiter',
      name: 'Rec Ruiter',
    }),
  })),
}));

jest.mock('src/engine/core-modules/arx-chat/utils/send-gmail', () => ({
  SendEmailFunctionality: jest.fn().mockImplementation(() => ({
    sendEmailFunction: jest.fn().mockResolvedValue({ ok: true }),
  })),
}));

describe('OrgChartOutreachService', () => {
  let service: OrgChartOutreachService;
  const getJobDetails = jest.fn();
  let loadSavedCredentialsIfExist: jest.Mock;
  let getExistingPhoneNumbers: jest.Mock;
  let batchCreateContacts: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSendLinkedinInviteForJob.mockResolvedValue({ success: true });
    mockSendTextToPhoneForJob.mockResolvedValue({ status: 'success' });
    getJobDetails.mockResolvedValue({
      id: 'job-1',
      recruiterId: 'wm-1',
      name: 'Test job',
    });
    loadSavedCredentialsIfExist = jest.fn().mockResolvedValue({});
    getExistingPhoneNumbers = jest.fn().mockResolvedValue(new Set<string>());
    batchCreateContacts = jest.fn().mockResolvedValue({ status: 'success' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrgChartOutreachService,
        {
          provide: WorkspaceQueryService,
          useValue: {},
        },
        {
          provide: StaticGraphQLService,
          useValue: {},
        },
        {
          provide: WorkspaceMemberProfileUnipileService,
          useValue: {},
        },
        {
          provide: GoogleContactsService,
          useValue: {
            loadSavedCredentialsIfExist,
            getExistingPhoneNumbers,
            batchCreateContacts,
          },
        },
        {
          provide: CandidateWorkspaceGraphQLService,
          useValue: {
            getJobDetails,
          },
        },
        {
          provide: WhatsappOutboundRateLimiterService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get(OrgChartOutreachService);
  });

  it('throws when job is missing', async () => {
    getJobDetails.mockResolvedValueOnce(null);
    await expect(
      service.run({
        channel: 'linkedin_invite',
        jobId: 'job-1',
        message: 'Hello',
        linkedinUrl: 'https://www.linkedin.com/in/someone',
        apiToken: 'tok',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('linkedin_invite delegates to messaging service', async () => {
    console.log('linkedin_invite test: calling run');
    const result = await service.run({
      channel: 'linkedin_invite',
      jobId: 'job-1',
      message: 'Hello there',
      linkedinUrl: 'https://www.linkedin.com/in/someone',
      apiToken: 'tok',
    });
    console.log('linkedin_invite test: result', result);
    expect(result.success).toBe(true);
    expect(mockSendLinkedinInviteForJob).toHaveBeenCalled();
  });

  it('whatsapp delegates to messaging service', async () => {
    console.log('whatsapp test: calling run');
    const result = await service.run({
      channel: 'whatsapp',
      jobId: 'job-1',
      message: 'Hi',
      phone: '+15551234567',
      apiToken: 'tok',
    });
    console.log('whatsapp test: result', result);
    expect(result.success).toBe(true);
    expect(mockSendTextToPhoneForJob).toHaveBeenCalled();
  });

  it('google_contact skips when phone already in contacts', async () => {
    console.log('google_contact skip duplicate');
    getExistingPhoneNumbers.mockResolvedValueOnce(new Set(['+100']));
    const result = await service.run({
      channel: 'google_contact',
      jobId: 'job-1',
      message: 'note',
      phone: '+100',
      email: 'a@b.co',
      fullName: 'Pat Example',
      apiToken: 'tok',
    });
    console.log('google_contact skip result', result);
    expect(result.skipped).toBe(true);
    expect(batchCreateContacts).not.toHaveBeenCalled();
  });

  it('google_contact calls batchCreateContacts when new', async () => {
    console.log('google_contact create');
    const result = await service.run({
      channel: 'google_contact',
      jobId: 'job-1',
      message: '',
      phone: '+1999',
      email: 'new@b.co',
      fullName: 'Sam Test',
      jobTitle: 'Eng',
      companyName: 'Co',
      apiToken: 'tok',
    });
    console.log('google_contact create result', result);
    expect(result.success).toBe(true);
    expect(batchCreateContacts).toHaveBeenCalled();
  });

  it('google_contact throws without Google auth', async () => {
    loadSavedCredentialsIfExist.mockResolvedValueOnce(null);
    await expect(
      service.run({
        channel: 'google_contact',
        jobId: 'job-1',
        message: 'x',
        phone: '+1',
        email: 'e@e.e',
        apiToken: 'tok',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('email completes when recruiter profile and recipient are present', async () => {
    console.log('email channel test');
    const result = await service.run({
      channel: 'email',
      jobId: 'job-1',
      message: 'Hello',
      email: 'cand@example.com',
      subject: 'Hi there',
      apiToken: 'tok',
    });
    console.log('email result', result);
    expect(result.success).toBe(true);
  });

  it('linkedin_invite throws when linkedinUrl missing', async () => {
    await expect(
      service.run({
        channel: 'linkedin_invite',
        jobId: 'job-1',
        message: 'm',
        apiToken: 'tok',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
