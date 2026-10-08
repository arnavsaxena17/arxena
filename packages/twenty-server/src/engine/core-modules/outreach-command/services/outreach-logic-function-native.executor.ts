import { Injectable, OnModuleInit } from '@nestjs/common';

import moment from 'moment-timezone';
import {
  OUTREACH_FETCH_COMPANY_DETAILS_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
  OUTREACH_VISIT_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_USER_COMMENTS_LOGIC_FUNCTION_NAME,
  OUTREACH_NATIVE_LOGIC_FUNCTION_NAMES,
  OUTREACH_SEARCH_COMPANIES_LOGIC_FUNCTION_NAME,
  OUTREACH_SEARCH_CRUNCHBASE_COMPANIES_LOGIC_FUNCTION_NAME,
  OUTREACH_SEARCH_JOBS_LOGIC_FUNCTION_NAME,
  OUTREACH_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME,
  OUTREACH_SEARCH_PEOPLE_LOGIC_FUNCTION_NAME,
  OUTREACH_SEARCH_POSTS_LOGIC_FUNCTION_NAME,
  OUTREACH_UPLOAD_PROFILES_LOGIC_FUNCTION_NAME,
  OUTREACH_UPSERT_COMPANIES_LOGIC_FUNCTION_NAME,
  OUTREACH_ENRICH_CONTACT_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_EMAIL_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_PHONE_LOGIC_FUNCTION_NAME,
  OUTREACH_GET_PROJECT_ATTACHMENTS_LOGIC_FUNCTION_NAME,
  OUTREACH_NOTIFY_MEMBER_SYSTEM_EMAIL_LOGIC_FUNCTION_NAME,
  OUTREACH_CREATE_REFERRAL_CANDIDATE_LOGIC_FUNCTION_NAME,
  OUTREACH_GET_CALENDAR_AVAILABILITY_LOGIC_FUNCTION_NAME,
  OUTREACH_DETECT_FAKE_PROFILES_LOGIC_FUNCTION_NAME,
  OUTREACH_FILTER_PROFILES_LOGIC_FUNCTION_NAME,
  OUTREACH_VALIDATE_INBOUND_SIGNALS_LOGIC_FUNCTION_NAME,
  OUTREACH_PLAN_LOCAL_BUSINESS_CITY_COVERAGE_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_AND_UPSERT_LOCAL_BUSINESSES_LOGIC_FUNCTION_NAME,
  OUTREACH_CLASSIFY_AND_UPSERT_LOCAL_PLACES_LOGIC_FUNCTION_NAME,
} from 'src/engine/core-modules/outreach-command/constants/outreach-logic-function-names.const';
import { OUTREACH_CALENDAR_REFERENCE_TIMEZONE } from 'src/engine/core-modules/outreach-command/constants/outreach-calendar-reference-timezone.const';
import {
  validateOutreachInboundSignals,
  type OutreachInboundSignalsInput,
} from 'src/engine/core-modules/outreach-command/utils/validate-outreach-inbound-signals.util';
import { FetchAndUpsertLocalBusinessesService } from 'src/engine/core-modules/outreach-command/services/fetch-and-upsert-local-businesses.service';
import { ClassifyAndUpsertLocalPlacesService } from 'src/engine/core-modules/outreach-command/services/classify-and-upsert-local-places.service';
import { FetchCompanyDetailsService } from 'src/engine/core-modules/outreach-command/services/fetch-company-details.service';
import { FetchLinkedinMessagesService } from 'src/engine/core-modules/outreach-command/services/fetch-linkedin-messages.service';
import { FetchLinkedinProfileService } from 'src/engine/core-modules/outreach-command/services/fetch-linkedin-profile.service';
import { VisitLinkedinProfileService } from 'src/engine/core-modules/outreach-command/services/visit-linkedin-profile.service';
import { FetchUserCommentsService } from 'src/engine/core-modules/outreach-command/services/fetch-user-comments.service';
import { PlanLocalBusinessCityCoverageService } from 'src/engine/core-modules/outreach-command/services/plan-local-business-city-coverage.service';
import { SearchCompaniesService } from 'src/engine/core-modules/outreach-command/services/search-companies.service';
import { SearchCrunchbaseCompaniesService } from 'src/engine/core-modules/outreach-command/services/search-crunchbase-companies.service';
import { SearchJobsService } from 'src/engine/core-modules/outreach-command/services/search-jobs.service';
import { SearchPeopleForCompanyService } from 'src/engine/core-modules/outreach-command/services/search-people-for-company.service';
import { SearchPeopleService } from 'src/engine/core-modules/outreach-command/services/search-people.service';
import { SearchPostsService } from 'src/engine/core-modules/outreach-command/services/search-posts.service';
import { UploadProfilesService } from 'src/engine/core-modules/outreach-command/services/upload-profiles.service';
import { UpsertCompaniesService } from 'src/engine/core-modules/outreach-command/services/upsert-companies.service';
import { EnrichContactService } from 'src/engine/core-modules/outreach-command/services/enrich-contact.service';
import {
  CreateReferralCandidateService,
  type CreateReferralCandidateInput,
} from 'src/engine/core-modules/outreach-command/services/create-referral-candidate.service';
import {
  NotifyMemberSystemEmailService,
  type NotifyMemberSystemEmailInput,
} from 'src/engine/core-modules/outreach-command/services/notify-member-system-email.service';
import { GetProjectAttachmentsService } from 'src/engine/core-modules/outreach-command/services/get-project-attachments.service';
import { GetCalendarAvailabilityService } from 'src/engine/core-modules/outreach-command/services/get-calendar-availability.service';
import { OutreachFakeProfileDetectorService } from 'src/engine/core-modules/outreach-command/services/outreach-fake-profile-detector.service';
import { OutreachFilterProfilesService } from 'src/engine/core-modules/outreach-command/services/outreach-filter-profiles.service';
import { NativeLogicFunctionHandler } from 'src/engine/core-modules/logic-function/logic-function-executor/native-logic-function-handler.interface';
import { NativeLogicFunctionRegistry } from 'src/engine/core-modules/logic-function/logic-function-executor/native-logic-function.registry';

@Injectable()
export class OutreachLogicFunctionNativeExecutor
  implements NativeLogicFunctionHandler, OnModuleInit
{
  constructor(
    private readonly searchPeopleForCompanyService: SearchPeopleForCompanyService,
    private readonly fetchLinkedinProfileService: FetchLinkedinProfileService,
    private readonly visitLinkedinProfileService: VisitLinkedinProfileService,
    private readonly fetchLinkedinMessagesService: FetchLinkedinMessagesService,
    private readonly fetchUserCommentsService: FetchUserCommentsService,
    private readonly fetchCompanyDetailsService: FetchCompanyDetailsService,
    private readonly searchPeopleService: SearchPeopleService,
    private readonly searchCompaniesService: SearchCompaniesService,
    private readonly searchCrunchbaseCompaniesService: SearchCrunchbaseCompaniesService,
    private readonly searchJobsService: SearchJobsService,
    private readonly searchPostsService: SearchPostsService,
    private readonly uploadProfilesService: UploadProfilesService,
    private readonly upsertCompaniesService: UpsertCompaniesService,
    private readonly enrichContactService: EnrichContactService,
    private readonly getCalendarAvailabilityService: GetCalendarAvailabilityService,
    private readonly getProjectAttachmentsService: GetProjectAttachmentsService,
    private readonly notifyMemberSystemEmailService: NotifyMemberSystemEmailService,
    private readonly createReferralCandidateService: CreateReferralCandidateService,
    private readonly gtmFakeProfileDetectorService: OutreachFakeProfileDetectorService,
    private readonly gtmFilterProfilesService: OutreachFilterProfilesService,
    private readonly planLocalBusinessCityCoverageService: PlanLocalBusinessCityCoverageService,
    private readonly fetchAndUpsertLocalBusinessesService: FetchAndUpsertLocalBusinessesService,
    private readonly classifyAndUpsertLocalPlacesService: ClassifyAndUpsertLocalPlacesService,
    private readonly nativeLogicFunctionRegistry: NativeLogicFunctionRegistry,
  ) {}

  onModuleInit(): void {
    this.nativeLogicFunctionRegistry.register(this);
  }

  isNative(name: string): boolean {
    return OUTREACH_NATIVE_LOGIC_FUNCTION_NAMES.has(name);
  }

  async execute({
    name,
    workspaceId,
    payload,
    workflowRunId,
    stepId,
  }: {
    name: string;
    workspaceId: string;
    payload: object;
    workflowRunId?: string;
    stepId?: string;
  }): Promise<object> {
    if (name === OUTREACH_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME) {
      return this.searchPeopleForCompanyService.execute({
        workspaceId,
        input: payload as {
          companyId: string;
          projectId?: string;
          jobTitle?: string;
          limit?: number;
        },
      });
    }

    if (name === OUTREACH_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME) {
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

    if (name === OUTREACH_VISIT_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME) {
      return this.visitLinkedinProfileService.execute({
        workspaceId,
        input: payload as {
          workspaceMemberId?: string;
          linkedinUrl?: string;
          linkedinProfileId?: string;
          candidateId?: string;
        },
      });
    }

    if (name === OUTREACH_SEARCH_PEOPLE_LOGIC_FUNCTION_NAME) {
      return this.searchPeopleService.execute({
        workspaceId,
        input: payload,
      });
    }

    if (name === OUTREACH_SEARCH_COMPANIES_LOGIC_FUNCTION_NAME) {
      return this.searchCompaniesService.execute({
        workspaceId,
        input: payload,
      });
    }

    if (name === OUTREACH_SEARCH_CRUNCHBASE_COMPANIES_LOGIC_FUNCTION_NAME) {
      return this.searchCrunchbaseCompaniesService.execute({
        workspaceId,
        input: payload as {
          searchUrl?: string;
          'search.url'?: string;
          url?: string;
          cookie?: unknown;
          workspaceMemberId?: string;
          cursor?: string;
          minDelay?: number;
          maxDelay?: number;
          projectId?: string;
          limit?: number;
        },
      });
    }

    if (name === OUTREACH_SEARCH_JOBS_LOGIC_FUNCTION_NAME) {
      return this.searchJobsService.execute({
        workspaceId,
        input: payload,
      });
    }

    if (name === OUTREACH_SEARCH_POSTS_LOGIC_FUNCTION_NAME) {
      return this.searchPostsService.execute({
        workspaceId,
        input: payload,
      });
    }

    if (name === OUTREACH_FETCH_USER_COMMENTS_LOGIC_FUNCTION_NAME) {
      return this.fetchUserCommentsService.execute({
        workspaceId,
        input: payload as {
          workspaceMemberId?: string;
          linkedinUrl?: string;
          linkedinProfileId?: string;
          candidateId?: string;
          userId?: string;
          accountId?: string;
          limit?: number;
          cursor?: string;
        },
      });
    }

    if (name === OUTREACH_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME) {
      return this.fetchLinkedinMessagesService.execute({
        workspaceId,
        input: payload as {
          workspaceMemberId?: string;
          linkedinUrl?: string;
          linkedinProfileId?: string;
          candidateId?: string;
          limit?: number;
          linkedinApi?: 'classic' | 'sales_navigator' | 'recruiter';
          forceRefresh?: boolean;
        },
      });
    }

    if (name === OUTREACH_FETCH_COMPANY_DETAILS_LOGIC_FUNCTION_NAME) {
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

    if (name === OUTREACH_UPLOAD_PROFILES_LOGIC_FUNCTION_NAME) {
      return this.uploadProfilesService.execute({
        workspaceId,
        workflowRunId,
        stepId,
        input: payload as {
          projectId?: string;
          companyId?: string;
          people?: unknown;
          candidates?: unknown;
          candidateId?: string;
          linkedinUrl?: string;
          limit?: number;
        },
      });
    }

    if (name === OUTREACH_UPSERT_COMPANIES_LOGIC_FUNCTION_NAME) {
      return this.upsertCompaniesService.execute({
        workspaceId,
        input: payload as {
          projectId?: string;
          companies?: unknown;
          limit?: number;
        },
      });
    }

    if (name === OUTREACH_ENRICH_CONTACT_LOGIC_FUNCTION_NAME) {
      return this.enrichContactService.execute({
        workspaceId,
        input: payload as {
          candidateId?: string;
          linkedinUrl?: string;
          wantEmail?: boolean;
          wantPhone?: boolean;
        },
      });
    }

    if (name === OUTREACH_FETCH_EMAIL_LOGIC_FUNCTION_NAME) {
      const input = payload as {
        candidateId?: string;
        linkedinUrl?: string;
      };

      return this.enrichContactService.execute({
        workspaceId,
        input: {
          ...input,
          wantEmail: true,
          wantPhone: false,
        },
      });
    }

    if (name === OUTREACH_FETCH_PHONE_LOGIC_FUNCTION_NAME) {
      const input = payload as {
        candidateId?: string;
        linkedinUrl?: string;
      };

      return this.enrichContactService.execute({
        workspaceId,
        input: {
          ...input,
          wantEmail: false,
          wantPhone: true,
        },
      });
    }

    if (name === OUTREACH_GET_CALENDAR_AVAILABILITY_LOGIC_FUNCTION_NAME) {
      const availability = await this.getCalendarAvailabilityService.execute({
        workspaceId,
        input: payload as {
          workspaceMemberId?: string;
          days?: number;
          slotMinutes?: number;
        },
      });

      // The extractor resolves "next Thursday 10pm" / "next quarter" against this
      // clock, so it must come from the server, not the model.
      return {
        ...availability,
        nowIso: new Date().toISOString(),
        nowLocal: moment()
          .tz(OUTREACH_CALENDAR_REFERENCE_TIMEZONE)
          .format('dddd, D MMM YYYY, h:mm A z'),
        timeZone: OUTREACH_CALENDAR_REFERENCE_TIMEZONE,
      };
    }

    if (name === OUTREACH_GET_PROJECT_ATTACHMENTS_LOGIC_FUNCTION_NAME) {
      return this.getProjectAttachmentsService.execute({
        workspaceId,
        input: payload as { projectId?: string; fileName?: string },
      });
    }

    if (name === OUTREACH_CREATE_REFERRAL_CANDIDATE_LOGIC_FUNCTION_NAME) {
      return this.createReferralCandidateService.execute({
        workspaceId,
        input: payload as CreateReferralCandidateInput,
      });
    }

    if (name === OUTREACH_NOTIFY_MEMBER_SYSTEM_EMAIL_LOGIC_FUNCTION_NAME) {
      return this.notifyMemberSystemEmailService.execute({
        input: payload as NotifyMemberSystemEmailInput,
      });
    }

    if (name === OUTREACH_DETECT_FAKE_PROFILES_LOGIC_FUNCTION_NAME) {
      return this.gtmFakeProfileDetectorService.execute({
        workspaceId,
        input: payload as {
          profile?: unknown;
          snapshot?: unknown;
          profiles?: unknown;
          modelId?: string;
        },
      });
    }

    if (name === OUTREACH_FILTER_PROFILES_LOGIC_FUNCTION_NAME) {
      return this.gtmFilterProfilesService.execute({
        workspaceId,
        input: payload as {
          profiles?: unknown;
          profile?: unknown;
          snapshot?: unknown;
          prompt?: string;
          modelId?: string;
          onlyOnePersonPerCompany?: boolean | string;
        },
      });
    }

    if (name === OUTREACH_VALIDATE_INBOUND_SIGNALS_LOGIC_FUNCTION_NAME) {
      return validateOutreachInboundSignals(
        payload as OutreachInboundSignalsInput,
      );
    }

    if (name === OUTREACH_PLAN_LOCAL_BUSINESS_CITY_COVERAGE_LOGIC_FUNCTION_NAME) {
      return this.planLocalBusinessCityCoverageService.execute({
        workspaceId,
        input: payload as {
          city?: string;
          keywords?: unknown;
          gridSpacingDeg?: number;
          zoom_level?: number;
          zoomLevel?: number;
          country?: string;
          minLat?: number;
          maxLat?: number;
          minLng?: number;
          maxLng?: number;
          sample?: boolean | string;
          expectedHitsPerCell?: number;
        },
      });
    }

    if (
      name === OUTREACH_FETCH_AND_UPSERT_LOCAL_BUSINESSES_LOGIC_FUNCTION_NAME
    ) {
      return this.fetchAndUpsertLocalBusinessesService.execute({
        workspaceId,
        input: payload as {
          cells?: Array<{ lat: number; lng: number }>;
          keywords?: unknown;
          zoom_level?: number;
          zoomLevel?: number;
          country?: string;
          maxRecords?: number;
          projectId?: string;
        },
      });
    }

    if (name === OUTREACH_CLASSIFY_AND_UPSERT_LOCAL_PLACES_LOGIC_FUNCTION_NAME) {
      return this.classifyAndUpsertLocalPlacesService.execute({
        workspaceId,
        input: payload as {
          places?: unknown;
          placesFilePath?: string;
          projectId?: string;
          minOutlets?: number;
          modelId?: string;
          maxCompanies?: number;
        },
      });
    }

    return {};
  }
}
