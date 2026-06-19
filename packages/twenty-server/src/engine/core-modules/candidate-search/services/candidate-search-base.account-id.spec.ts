jest.mock('openai', () => ({
  __esModule: true,
  default: class MockOpenAI {
    constructor(_opts?: { apiKey?: string }) {}
  },
}));

import { Test } from '@nestjs/testing';
import { LinkedinUnipileSessionService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-session.service';
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
  let workspaceMemberProfileUnipileService: Record<string, unknown>;
  let linkedinUnipileSessionService: {
    ensureLinkedinAccountId: jest.Mock;
  };

  beforeEach(async () => {
    workspaceQueryService = {
      getWorkspaceIdFromToken: jest.fn().mockResolvedValue('workspace-id'),
      getWorkspaceMemberIdFromToken: jest
        .fn()
        .mockResolvedValue('workspace-member-id'),
    };
    workspaceMemberProfileUnipileService = {};
    linkedinUnipileSessionService = {
      ensureLinkedinAccountId: jest.fn().mockResolvedValue('session-account'),
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
        {
          provide: LinkedinUnipileSessionService,
          useValue: linkedinUnipileSessionService,
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

  it('delegates explicit account id to LinkedinUnipileSessionService', async () => {
    linkedinUnipileSessionService.ensureLinkedinAccountId.mockResolvedValue(
      'kn5idzvKTdGgKehaMbtTjA',
    );
    const id = await service.getLinkedInAccountId(
      'token',
      'kn5idzvKTdGgKehaMbtTjA',
    );
    expect(id).toBe('kn5idzvKTdGgKehaMbtTjA');
    expect(linkedinUnipileSessionService.ensureLinkedinAccountId).toHaveBeenCalledWith(
      'token',
      'kn5idzvKTdGgKehaMbtTjA',
    );
  });

  it('returns the resolved session account id for implicit lookups', async () => {
    linkedinUnipileSessionService.ensureLinkedinAccountId.mockResolvedValue(
      'b-UZjNaPS_iTORng22zrtA',
    );

    const id = await service.getLinkedInAccountId('token');

    expect(id).toBe('b-UZjNaPS_iTORng22zrtA');
    expect(linkedinUnipileSessionService.ensureLinkedinAccountId).toHaveBeenCalledWith(
      'token',
      undefined,
    );
  });

  it('falls back to env when session lookup throws', async () => {
    process.env.UNIPILE_LINKEDIN_ACCOUNT_ID = 'env-account';
    linkedinUnipileSessionService.ensureLinkedinAccountId.mockRejectedValue(
      new Error('session unavailable'),
    );

    const id = await service.getLinkedInAccountId('token');

    expect(id).toBe('env-account');
  });
});
