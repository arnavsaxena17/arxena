import { Injectable, OnModuleInit } from '@nestjs/common';

import {
  GTM_FETCH_COMPANY_DETAILS_LOGIC_FUNCTION_NAME,
  GTM_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME,
  GTM_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
  GTM_NATIVE_LOGIC_FUNCTION_NAMES,
  GTM_SEARCH_COMPANIES_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_JOBS_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_PEOPLE_LOGIC_FUNCTION_NAME,
} from 'src/engine/core-modules/gtm-command/constants/gtm-logic-function-names.const';
import { FetchCompanyDetailsService } from 'src/engine/core-modules/gtm-command/services/fetch-company-details.service';
import { FetchLinkedinMessagesService } from 'src/engine/core-modules/gtm-command/services/fetch-linkedin-messages.service';
import { FetchLinkedinProfileService } from 'src/engine/core-modules/gtm-command/services/fetch-linkedin-profile.service';
import { SearchCompaniesService } from 'src/engine/core-modules/gtm-command/services/search-companies.service';
import { SearchJobsService } from 'src/engine/core-modules/gtm-command/services/search-jobs.service';
import { SearchPeopleForCompanyService } from 'src/engine/core-modules/gtm-command/services/search-people-for-company.service';
import { SearchPeopleService } from 'src/engine/core-modules/gtm-command/services/search-people.service';
import { NativeLogicFunctionHandler } from 'src/engine/core-modules/logic-function/logic-function-executor/native-logic-function-handler.interface';
import { NativeLogicFunctionRegistry } from 'src/engine/core-modules/logic-function/logic-function-executor/native-logic-function.registry';

@Injectable()
export class GtmLogicFunctionNativeExecutor
  implements NativeLogicFunctionHandler, OnModuleInit
{
  constructor(
    private readonly searchPeopleForCompanyService: SearchPeopleForCompanyService,
    private readonly fetchLinkedinProfileService: FetchLinkedinProfileService,
    private readonly fetchLinkedinMessagesService: FetchLinkedinMessagesService,
    private readonly fetchCompanyDetailsService: FetchCompanyDetailsService,
    private readonly searchPeopleService: SearchPeopleService,
    private readonly searchCompaniesService: SearchCompaniesService,
    private readonly searchJobsService: SearchJobsService,
    private readonly nativeLogicFunctionRegistry: NativeLogicFunctionRegistry,
  ) {}

  onModuleInit(): void {
    this.nativeLogicFunctionRegistry.register(this);
  }

  isNative(name: string): boolean {
    return GTM_NATIVE_LOGIC_FUNCTION_NAMES.has(name);
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

    if (name === GTM_SEARCH_PEOPLE_LOGIC_FUNCTION_NAME) {
      return this.searchPeopleService.execute({
        workspaceId,
        input: payload,
      });
    }

    if (name === GTM_SEARCH_COMPANIES_LOGIC_FUNCTION_NAME) {
      return this.searchCompaniesService.execute({
        workspaceId,
        input: payload,
      });
    }

    if (name === GTM_SEARCH_JOBS_LOGIC_FUNCTION_NAME) {
      return this.searchJobsService.execute({
        workspaceId,
        input: payload,
      });
    }

    if (name === GTM_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME) {
      return this.fetchLinkedinMessagesService.execute({
        workspaceId,
        input: payload as {
          workspaceMemberId?: string;
          linkedinUrl?: string;
          linkedinProfileId?: string;
          candidateId?: string;
          limit?: number;
        },
      });
    }

    if (name === GTM_FETCH_COMPANY_DETAILS_LOGIC_FUNCTION_NAME) {
      return this.fetchCompanyDetailsService.execute({
        workspaceId,
        input: payload as {
          companyName?: string;
          website?: string;
          linkedinUrl?: string;
          workspaceMemberId?: string;
          accountId?: string;
        },
      });
    }

    return {};
  }
}
