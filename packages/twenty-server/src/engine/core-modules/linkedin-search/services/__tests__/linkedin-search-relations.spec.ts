import { Test } from '@nestjs/testing';
import { ApifyService } from 'src/engine/core-modules/apify/services/apify.service';
import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { ApifyLinkedInCompanyProfileTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/apify-linkedin-company-profile-transformer.service';
import { LinkedInHtmlParserService } from 'src/engine/core-modules/linkedin-search/services/linkedin-html-parser.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import { LinkedInSessionTrackerService } from 'src/engine/core-modules/linkedin-search/services/linkedin-session-tracker.service';
import { UnipileV2AccountResolver } from 'src/engine/core-modules/linkedin-search/services/unipile-v2-account.resolver';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

describe('LinkedInSearchService.getRelations', () => {
  it('calls Unipile relations and returns the last n connections newest first', async () => {
    const fetchLinkedinRelations = jest.fn().mockResolvedValue({
      object: 'UserRelationsList',
      items: [
        {
          object: 'UserRelation',
          first_name: 'Old',
          last_name: 'One',
          created_at: 100,
          public_identifier: 'old-one',
          public_profile_url: 'https://www.linkedin.com/in/old-one',
        },
        {
          object: 'UserRelation',
          first_name: 'New',
          last_name: 'Two',
          created_at: 300,
          public_identifier: 'new-two',
          public_profile_url: 'https://www.linkedin.com/in/new-two',
        },
        {
          object: 'UserRelation',
          first_name: 'Mid',
          last_name: 'Three',
          created_at: 200,
          public_identifier: 'mid-three',
          public_profile_url: 'https://www.linkedin.com/in/mid-three',
        },
      ],
      cursor: 'next',
    });

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
        {
          provide: LinkedinUnipileRequestService,
          useValue: { fetchLinkedinRelations },
        },
      ],
    }).compile();

    const service = moduleRef.get(LinkedInSearchService);
    const result = await service.getRelations('acc-1', { limit: 2 });

    expect(fetchLinkedinRelations).toHaveBeenCalledWith('acc-1', {
      limit: 2,
      cursor: undefined,
      filter: undefined,
    });
    expect(result.items.map((item) => item.first_name)).toEqual(['New', 'Mid']);
    expect(result.cursor).toBe('next');
  });
});
