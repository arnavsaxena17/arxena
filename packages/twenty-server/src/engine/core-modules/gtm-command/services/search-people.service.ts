import { Injectable, Logger } from '@nestjs/common';

import { GtmWorkspaceAuthTokenService } from 'src/engine/core-modules/gtm-command/services/gtm-workspace-auth-token.service';
import { extractLinkedinProfileId } from 'src/engine/core-modules/gtm-command/utils/extract-linkedin-profile-id.util';
import { PeopleApiService } from 'src/engine/core-modules/people-api/people-api.service';

export type SearchPeopleInput = {
  naturalLanguage?: string;
  companyName?: string;
  website?: string;
  companyId?: string;
  jobTitle?: string;
  location?: string;
  country?: string;
  dataSource?: string;
  accountId?: string;
  limit?: number;
};

const readString = (item: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const readTaxonomy = (
  item: Record<string, unknown>,
): {
  stdFunction: string;
  stdFunctionRoot: string;
  stdGrade: string;
} => {
  const resolved =
    item.resolved && typeof item.resolved === 'object'
      ? (item.resolved as Record<string, unknown>)
      : item;

  return {
    stdFunction: readString(resolved, ['stdFunction']),
    stdFunctionRoot: readString(resolved, ['stdFunctionRoot']),
    stdGrade: readString(resolved, ['stdGrade']),
  };
};

@Injectable()
export class SearchPeopleService {
  private readonly logger = new Logger(SearchPeopleService.name);

  constructor(
    private readonly peopleApiService: PeopleApiService,
    private readonly gtmWorkspaceAuthTokenService: GtmWorkspaceAuthTokenService,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: SearchPeopleInput;
  }): Promise<object> {
    try {
      const apiToken =
        await this.gtmWorkspaceAuthTokenService.resolveApiKeyToken(workspaceId);

      const limit = Math.min(Math.max(1, input.limit ?? 10), 25);
      const search = await this.peopleApiService.searchPeople(
        {
          naturalLanguage: input.naturalLanguage,
          companyName: input.companyName,
          website: input.website,
          companyId: input.companyId,
          jobTitle: input.jobTitle,
          location: input.location,
          country: input.country,
          dataSource: (input.dataSource as never) ?? 'auto',
          accountId: input.accountId,
          limit,
        },
        apiToken ?? undefined,
        { workspaceId },
      );

      const people = (search.items ?? []).map((item) => {
        const firstName = readString(item, ['firstName', 'first_name']);
        const lastName = readString(item, ['lastName', 'last_name']);
        const linkedinUrl = readString(item, [
          'linkedinUrl',
          'linkedin_url',
          'profile_url',
          'profileUrl',
          'public_profile_url',
          'url',
        ]);
        const taxonomy = readTaxonomy(item);

        return {
          name:
            readString(item, ['name', 'fullName']) ||
            [firstName, lastName].filter(Boolean).join(' '),
          firstName,
          lastName,
          title: readString(item, ['title', 'jobTitle', 'headline']),
          headline: readString(item, ['headline', 'linkedinHeadline', 'title']),
          companyName: readString(item, [
            'companyName',
            'company',
            'org',
            'jobCompanyName',
          ]),
          location: readString(item, ['location', 'locationName']),
          linkedinUrl,
          linkedinProfileId:
            readString(item, [
              'linkedinProfileId',
              'public_identifier',
              'peopleId',
            ]) || extractLinkedinProfileId(linkedinUrl),
          peopleId: readString(item, ['peopleId', 'id']),
          profilePictureUrl: readString(item, [
            'profilePictureUrl',
            'displayPicture',
            'profile_picture_url',
          ]),
          source: readString(item, ['source']) || search.dataSource,
          ...taxonomy,
        };
      });

      return {
        success: true,
        total: search.total ?? people.length,
        dataSource: search.dataSource,
        error: '',
        people,
      };
    } catch (error) {
      this.logger.error('search-people failed', error);

      return {
        success: false,
        total: 0,
        dataSource: input.dataSource ?? 'auto',
        error: error instanceof Error ? error.message : String(error),
        people: [],
      };
    }
  }
}
