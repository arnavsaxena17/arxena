jest.mock('openai', () => ({
  __esModule: true,
  default: class MockOpenAI {
    constructor(_opts?: { apiKey?: string }) {}
  },
}));

import { Test } from '@nestjs/testing';
import { LinkedinUnipileSessionService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-session.service';
import { LinkedinParameterCatalogService } from 'src/domains/discovery/transport/linkedin-search/services/linkedin-parameter-catalog.service';
import { LinkedinParameterResolver } from 'src/domains/discovery/transport/linkedin-search/utils/linkedin-parameter-resolver.util';
import { LinkedInSearchService } from 'src/domains/discovery/transport/linkedin-search/services/linkedin-search.service';
import { LinkedinSearchExecutionBase } from 'src/domains/discovery/query/services/linkedin-search-execution.base';
import { ParameterSanitizer } from 'src/domains/discovery/query/utils/parameter-sanitizer.util';

describe('LinkedinSearchExecutionBase.getLinkedInAccountId', () => {
  let service: LinkedinSearchExecutionBase;
  let linkedinUnipileSessionService: {
    ensureLinkedinAccountId: jest.Mock;
  };

  beforeEach(async () => {
    linkedinUnipileSessionService = {
      ensureLinkedinAccountId: jest.fn().mockResolvedValue('session-account'),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LinkedinSearchExecutionBase,
        // The account lookup itself now lives on the parameter catalogue; the
        // base delegates to it, so the real catalogue is wired here.
        LinkedinParameterCatalogService,
        { provide: LinkedInSearchService, useValue: {} },
        {
          provide: LinkedinUnipileSessionService,
          useValue: linkedinUnipileSessionService,
        },
        { provide: LinkedinParameterResolver, useValue: {} },
        { provide: ParameterSanitizer, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(LinkedinSearchExecutionBase);
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
    expect(
      linkedinUnipileSessionService.ensureLinkedinAccountId,
    ).toHaveBeenCalledWith('token', 'kn5idzvKTdGgKehaMbtTjA');
  });

  it('returns the resolved session account id for implicit lookups', async () => {
    linkedinUnipileSessionService.ensureLinkedinAccountId.mockResolvedValue(
      'b-UZjNaPS_iTORng22zrtA',
    );

    const id = await service.getLinkedInAccountId('token');

    expect(id).toBe('b-UZjNaPS_iTORng22zrtA');
    expect(
      linkedinUnipileSessionService.ensureLinkedinAccountId,
    ).toHaveBeenCalledWith('token', undefined);
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
