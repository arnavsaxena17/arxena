jest.mock('openai', () => ({
  __esModule: true,
  default: class MockOpenAI {
    constructor(_opts?: { apiKey?: string }) {}
  },
}));

import { Test } from '@nestjs/testing';
import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';
import { CandidateSearchBaseService } from 'src/engine/core-modules/candidate-search/services/candidate-search-base.service';
import { JobDescriptionService } from 'src/engine/core-modules/candidate-search/services/job-description.service';
import {
    FileUtils,
    LinkedinParameterResolver,
    ParameterSanitizer,
} from 'src/engine/core-modules/candidate-search/utils';
import { LinkedInSearchTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { ResumeReadParseUploadService } from 'src/engine/core-modules/candidate-sourcing/services/resume-read-parse-upload.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

describe('CandidateSearchBaseService.getLinkedInAccountId', () => {
  let service: CandidateSearchBaseService;
  let workspaceQueryService: {
    getWorkspaceIdFromToken: jest.Mock;
    getWorkspaceMemberIdFromToken: jest.Mock;
  };
  let workspaceMemberProfileUnipileService: {
    getWorkspaceMemberUnipileAccountId: jest.Mock;
  };
  const prevEnv = process.env.UNIPILE_LINKEDIN_ACCOUNT_ID;

  afterEach(() => {
    if (prevEnv === undefined) {
      delete process.env.UNIPILE_LINKEDIN_ACCOUNT_ID;
    } else {
      process.env.UNIPILE_LINKEDIN_ACCOUNT_ID = prevEnv;
    }
  });

  beforeEach(async () => {
    delete process.env.UNIPILE_LINKEDIN_ACCOUNT_ID;

    workspaceQueryService = {
      getWorkspaceIdFromToken: jest.fn().mockResolvedValue('workspace-id'),
      getWorkspaceMemberIdFromToken: jest
        .fn()
        .mockResolvedValue('workspace-member-id'),
    };
    workspaceMemberProfileUnipileService = {
      getWorkspaceMemberUnipileAccountId: jest.fn().mockResolvedValue(null),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CandidateSearchBaseService,
        { provide: LinkedInSearchService, useValue: {} },
        { provide: WorkspaceQueryService, useValue: workspaceQueryService },
        {
          provide: WorkspaceMemberProfileUnipileService,
          useValue: workspaceMemberProfileUnipileService,
        },
        { provide: LinkedinParameterResolver, useValue: {} },
        { provide: ParameterSanitizer, useValue: {} },
        { provide: FileUtils, useValue: {} },
        { provide: LinkedInSearchTransformerService, useValue: {} },
        { provide: StaticGraphQLService, useValue: {} },
        { provide: ResumeReadParseUploadService, useValue: {} },
        { provide: JobDescriptionService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(CandidateSearchBaseService);
  });

  it('returns explicit account id when provided and env is unset', async () => {
    const id = await service.getLinkedInAccountId(
      'token',
      'kn5idzvKTdGgKehaMbtTjA',
    );
    expect(id).toBe('kn5idzvKTdGgKehaMbtTjA');
    expect(
      workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId,
    ).not.toHaveBeenCalled();
  });

  it('prefers explicit account id over workspace member profile and env', async () => {
    process.env.UNIPILE_LINKEDIN_ACCOUNT_ID = 'env-account';
    workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId.mockResolvedValue(
      'profile-account',
    );

    const id = await service.getLinkedInAccountId(
      'token',
      'explicit-account',
    );

    expect(id).toBe('explicit-account');
    expect(
      workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId,
    ).not.toHaveBeenCalled();
  });

  it('prefers workspace member profile over UNIPILE_LINKEDIN_ACCOUNT_ID env', async () => {
    process.env.UNIPILE_LINKEDIN_ACCOUNT_ID = 'env-account';
    workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId.mockResolvedValue(
      'b-UZjNaPS_iTORng22zrtA',
    );

    const id = await service.getLinkedInAccountId('token');

    expect(id).toBe('b-UZjNaPS_iTORng22zrtA');
  });

  it('falls back to UNIPILE_LINKEDIN_ACCOUNT_ID when profile has no account id', async () => {
    process.env.UNIPILE_LINKEDIN_ACCOUNT_ID = 'env-account';
    workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId.mockResolvedValue(
      null,
    );

    const id = await service.getLinkedInAccountId('token');

    expect(id).toBe('env-account');
  });

  it('falls back to UNIPILE_LINKEDIN_ACCOUNT_ID when profile lookup throws', async () => {
    process.env.UNIPILE_LINKEDIN_ACCOUNT_ID = 'env-account';
    workspaceQueryService.getWorkspaceIdFromToken.mockRejectedValue(
      new Error('token invalid'),
    );

    const id = await service.getLinkedInAccountId('token');

    expect(id).toBe('env-account');
  });

  it('throws when profile and env fallback are both unavailable', async () => {
    workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId.mockResolvedValue(
      null,
    );

    await expect(service.getLinkedInAccountId('token')).rejects.toThrow(
      'Failed to get LinkedIn account ID',
    );
  });
});
