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

    const moduleRef = await Test.createTestingModule({
      providers: [
        CandidateSearchBaseService,
        { provide: LinkedInSearchService, useValue: {} },
        { provide: WorkspaceQueryService, useValue: {} },
        { provide: WorkspaceMemberProfileUnipileService, useValue: {} },
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

  it('returns explicit account id when provided (e.g. kn5idzvKTdGgKehaMbtTjA) and env is unset', async () => {
    const id = await service.getLinkedInAccountId(
      'token',
      'kn5idzvKTdGgKehaMbtTjA',
    );
    expect(id).toBe('kn5idzvKTdGgKehaMbtTjA');
  });

  it('prefers UNIPILE_LINKEDIN_ACCOUNT_ID env over explicit id', async () => {
    process.env.UNIPILE_LINKEDIN_ACCOUNT_ID = 'env-account';
    const id = await service.getLinkedInAccountId(
      'token',
      'explicit-should-lose',
    );
    expect(id).toBe('env-account');
  });
});
