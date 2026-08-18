import { Injectable } from '@nestjs/common';

import {
  GTM_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME,
} from 'src/engine/core-modules/gtm-command/constants/gtm-logic-function-names.const';
import { FetchLinkedinProfileService } from 'src/engine/core-modules/gtm-command/services/fetch-linkedin-profile.service';
import { SearchPeopleForCompanyService } from 'src/engine/core-modules/gtm-command/services/search-people-for-company.service';

@Injectable()
export class GtmLogicFunctionNativeExecutor {
  constructor(
    private readonly searchPeopleForCompanyService: SearchPeopleForCompanyService,
    private readonly fetchLinkedinProfileService: FetchLinkedinProfileService,
  ) {}

  isNative(name: string): boolean {
    return (
      name === GTM_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME ||
      name === GTM_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME
    );
  }

  async execute({
    name,
    workspaceId,
    payload,
  }: {
    name: string;
    workspaceId: string;
    payload: object;
  }): Promise<object> {
    if (name === GTM_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME) {
      return this.searchPeopleForCompanyService.execute({
        workspaceId,
        input: payload as { companyId: string; projectId?: string; limit?: number },
      });
    }

    if (name === GTM_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME) {
      return this.fetchLinkedinProfileService.execute({
        workspaceId,
        input: payload as {
          workspaceMemberId?: string;
          linkedinUrl?: string;
          linkedinProfileId?: string;
          candidateId?: string;
        },
      });
    }

    return {};
  }
}
