import { Test } from '@nestjs/testing';
import { ApifyService } from 'src/engine/core-modules/apify/services/apify.service';
import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { ApifyLinkedInCompanyProfileTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/apify-linkedin-company-profile-transformer.service';
import { LinkedInHtmlParserService } from 'src/engine/core-modules/linkedin-search/services/linkedin-html-parser.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import { LinkedInSessionTrackerService } from 'src/engine/core-modules/linkedin-search/services/linkedin-session-tracker.service';
import { UnipileSearchResultsCacheService } from 'src/engine/core-modules/linkedin-search/services/unipile-search-results-cache.service';
import { UnipileV2AccountResolver } from 'src/engine/core-modules/linkedin-search/services/unipile-v2-account.resolver';
import type { LinkedInSearchResponse } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

const cachedResponse: LinkedInSearchResponse = {
  object: 'LinkedinSearch',
  items: [],
  config: { params: {} },
  paging: { start: 0, page_count: 0, total_count: 0 },
  cursor: null,
};

describe('LinkedInSearchService Unipile search cache', () => {
  const getOrFetch = jest.fn();

  const createService = async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        LinkedInSearchService,
        { provide: LinkedInSessionTrackerService, useValue: {} },
        { provide: WorkspaceQueryService, useValue: {} },
        { provide: LinkedInHtmlParserService, useValue: {} },
        { provide: ApifyService, useValue: {} },
        {
          provide: ApifyLinkedInCompanyProfileTransformerService,
          useValue: {},
        },
        { provide: UnipileV2AccountResolver, useValue: {} },
        { provide: LinkedinUnipileRequestService, useValue: {} },
        {
          provide: UnipileSearchResultsCacheService,
          useValue: { getOrFetch },
        },
      ],
    }).compile();

    return moduleRef.get(LinkedInSearchService);
  };

  beforeEach(() => {
    getOrFetch.mockReset();
    getOrFetch.mockResolvedValue(cachedResponse);
  });

  it('looks up cached Unipile results before calling Unipile', async () => {
    const service = await createService();
    const searchRequest = {
      api: 'sales_navigator' as const,
      category: 'people' as const,
      keywords: 'CEO',
    };

    const result = await service.search(searchRequest, 'acct-1', { limit: 10 });

    expect(result).toBe(cachedResponse);
    expect(getOrFetch).toHaveBeenCalledTimes(1);
    expect(getOrFetch).toHaveBeenCalledWith(
      {
        accountId: 'acct-1',
        searchRequest,
        cursor: undefined,
        limit: 10,
      },
      expect.any(Function),
    );
  });
});
