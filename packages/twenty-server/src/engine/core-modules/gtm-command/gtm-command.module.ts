import { Module, forwardRef } from '@nestjs/common';

import { AccountRateLimitModule } from 'src/engine/core-modules/account-rate-limit/account-rate-limit.module';
import { UnipileCompanyService } from 'src/engine/core-modules/arx-chat/services/unipile-company.service';
import { UnipilePoolModule } from 'src/engine/core-modules/arx-chat/unipile-pool.module';
import { ApiKeyModule } from 'src/engine/core-modules/api-key/api-key.module';
import { CandidateSearchModule } from 'src/engine/core-modules/candidate-search/candidate-search.module';
import { CandidateSourcingModule } from 'src/engine/core-modules/candidate-sourcing/candidate-sourcing.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { GtmCommandController } from 'src/engine/core-modules/gtm-command/controllers/gtm-command.controller';
import { GtmInboundReplyWindowService } from 'src/engine/core-modules/gtm-command/jobs/gtm-inbound-reply-window.job';
import { LinkedinProviderIdStoreService } from 'src/engine/core-modules/gtm-command/services/linkedin-provider-id.store';
import { GtmWorkspaceProfileBootstrapJob } from 'src/engine/core-modules/gtm-command/jobs/gtm-workspace-profile-bootstrap.job';
import { EnsureGtmProjectService } from 'src/engine/core-modules/gtm-command/services/ensure-gtm-project.service';
import { FetchCompanyDetailsService } from 'src/engine/core-modules/gtm-command/services/fetch-company-details.service';
import { FetchLinkedinMessagesService } from 'src/engine/core-modules/gtm-command/services/fetch-linkedin-messages.service';
import { FetchLinkedinProfileService } from 'src/engine/core-modules/gtm-command/services/fetch-linkedin-profile.service';
import { GtmLogicFunctionNativeExecutor } from 'src/engine/core-modules/gtm-command/services/gtm-logic-function-native.executor';
import { GtmUnipilePacingService } from 'src/engine/core-modules/gtm-command/services/gtm-unipile-pacing.service';
import { SearchPeopleForCompanyService } from 'src/engine/core-modules/gtm-command/services/search-people-for-company.service';
import { SearchPeopleService } from 'src/engine/core-modules/gtm-command/services/search-people.service';
import { SearchCompaniesService } from 'src/engine/core-modules/gtm-command/services/search-companies.service';
import { SearchJobsService } from 'src/engine/core-modules/gtm-command/services/search-jobs.service';
import { SearchPostsService } from 'src/engine/core-modules/gtm-command/services/search-posts.service';
import { UploadProfilesService } from 'src/engine/core-modules/gtm-command/services/upload-profiles.service';
import { UploadProfilesWorkflowResumeService } from 'src/engine/core-modules/gtm-command/services/upload-profiles-workflow-resume.service';
import { UpsertCompaniesService } from 'src/engine/core-modules/gtm-command/services/upsert-companies.service';
import { EnrichContactService } from 'src/engine/core-modules/gtm-command/services/enrich-contact.service';
import { GetCalendarAvailabilityService } from 'src/engine/core-modules/gtm-command/services/get-calendar-availability.service';
import { GtmFakeProfileDetectorService } from 'src/engine/core-modules/gtm-command/services/gtm-fake-profile-detector.service';
import { GtmFilterProfilesService } from 'src/engine/core-modules/gtm-command/services/gtm-filter-profiles.service';
import { GtmOutreachMessagePersistService } from 'src/engine/core-modules/gtm-command/services/gtm-outreach-message-persist.service';
import { PeopleApiModule } from 'src/engine/core-modules/people-api/people-api.module';
import { CompanyApiModule } from 'src/engine/core-modules/company-api/company-api.module';
import { JobsApiModule } from 'src/engine/core-modules/jobs-api/jobs-api.module';
import { PostsApiModule } from 'src/engine/core-modules/posts-api/posts-api.module';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { GtmCompaniesIndexWikiEnrichmentSource } from 'src/engine/core-modules/gtm-command/services/gtm-companies-index-wiki-enrichment.source';
import {
  GTM_COMPANY_ENRICHMENT_SOURCES,
  GtmCompanyEnrichmentCollectorService,
} from 'src/engine/core-modules/gtm-command/services/gtm-company-enrichment-collector.service';
import { GtmCompanyProfileSummarizerService } from 'src/engine/core-modules/gtm-command/services/gtm-company-profile-summarizer.service';
import { GtmIcpBootstrapSummarizerService } from 'src/engine/core-modules/gtm-command/services/gtm-icp-bootstrap-summarizer.service';
import { GtmCommandMaterializeService } from 'src/engine/core-modules/gtm-command/services/gtm-command-materialize.service';
import { GtmInboundReplyClassifierService } from 'src/engine/core-modules/gtm-command/services/gtm-inbound-reply-classifier.service';
import { GtmCompaniesCacheService } from 'src/engine/core-modules/gtm-command/services/gtm-companies-cache.service';
import { GtmLinkedInPoolCompanyEnrichmentSource } from 'src/engine/core-modules/gtm-command/services/gtm-linkedin-pool-company-enrichment.source';
import { GtmOutreachThrottleService } from 'src/engine/core-modules/gtm-command/services/gtm-outreach-throttle.service';
import { GtmPeopleCacheService } from 'src/engine/core-modules/gtm-command/services/gtm-people-cache.service';
import { GtmWikidataCompanyEnrichmentSource } from 'src/engine/core-modules/gtm-command/services/gtm-wikidata-company-enrichment.source';
import { GtmWebSearchCompanyEnrichmentSource } from 'src/engine/core-modules/gtm-command/services/gtm-web-search-company-enrichment.source';
import { GtmWorkspaceAuthTokenService } from 'src/engine/core-modules/gtm-command/services/gtm-workspace-auth-token.service';
import { GtmWorkspaceProfileProvisioningService } from 'src/engine/core-modules/gtm-command/services/gtm-workspace-profile-provisioning.service';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { LinkedInSearchModule } from 'src/engine/core-modules/linkedin-search/linkedin-search.module';
import { LogicFunctionExecutorModule } from 'src/engine/core-modules/logic-function/logic-function-executor/logic-function-executor.module';
import { CompaniesEsService } from 'src/engine/core-modules/org-chart/services/companies-es.service';
import { WikidataModule } from 'src/engine/core-modules/wikidata/wikidata.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { ContactEnrichmentModule } from 'src/engine/core-modules/contact-enrichment/contact-enrichment.module';
import { GoogleCalendarModule } from 'src/engine/core-modules/calendar-events/google-calendar.module';
import { WorkflowRunModule } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.module';

@Module({
  imports: [
    GraphQLExecutionModule,
    AccountRateLimitModule,
    LogicFunctionExecutorModule,
    WorkspaceModificationsModule,
    forwardRef(() => CandidateSearchModule),
    forwardRef(() => LinkedInSearchModule),
    UnipilePoolModule,
    EnvironmentModule,
    WikidataModule,
    ApiKeyModule,
    forwardRef(() => PeopleApiModule),
    CompanyApiModule,
    JobsApiModule,
    PostsApiModule,
    JwtModule,
    forwardRef(() => CandidateSourcingModule),
    ContactEnrichmentModule,
    GoogleCalendarModule,
    WorkflowRunModule,
  ],
  controllers: [GtmCommandController],
  providers: [
    GtmCommandMaterializeService,
    GtmInboundReplyClassifierService,
    GtmOutreachThrottleService,
    GtmCompaniesCacheService,
    GtmPeopleCacheService,
    CompaniesEsService,
    UnipileCompanyService,
    GtmCompaniesIndexWikiEnrichmentSource,
    GtmWikidataCompanyEnrichmentSource,
    GtmLinkedInPoolCompanyEnrichmentSource,
    GtmWebSearchCompanyEnrichmentSource,
    {
      provide: GTM_COMPANY_ENRICHMENT_SOURCES,
      useFactory: (
        wikiSource: GtmCompaniesIndexWikiEnrichmentSource,
        linkedInPoolSource: GtmLinkedInPoolCompanyEnrichmentSource,
        wikidataSource: GtmWikidataCompanyEnrichmentSource,
        webSearchSource: GtmWebSearchCompanyEnrichmentSource,
      ) => [
        // Order: companies ES (free_company_dataset) → LinkedIn autocomplete → Wikidata → website web_search
        wikiSource,
        linkedInPoolSource,
        wikidataSource,
        webSearchSource,
      ],
      inject: [
        GtmCompaniesIndexWikiEnrichmentSource,
        GtmLinkedInPoolCompanyEnrichmentSource,
        GtmWikidataCompanyEnrichmentSource,
        GtmWebSearchCompanyEnrichmentSource,
      ],
    },
    GtmCompanyEnrichmentCollectorService,
    GtmCompanyProfileSummarizerService,
    GtmIcpBootstrapSummarizerService,
    GtmWorkspaceProfileProvisioningService,
    GtmWorkspaceProfileBootstrapJob,
    GtmWorkspaceAuthTokenService,
    EnsureGtmProjectService,
    SearchPeopleForCompanyService,
    SearchPeopleService,
    SearchCompaniesService,
    SearchJobsService,
    SearchPostsService,
    LinkedinProviderIdStoreService,
    FetchLinkedinProfileService,
    FetchLinkedinMessagesService,
    FetchCompanyDetailsService,
    UploadProfilesService,
    UploadProfilesWorkflowResumeService,
    UpsertCompaniesService,
    EnrichContactService,
    GetCalendarAvailabilityService,
    GtmFakeProfileDetectorService,
    GtmFilterProfilesService,
    GtmOutreachMessagePersistService,
    GtmLogicFunctionNativeExecutor,
    GtmUnipilePacingService,
    GtmInboundReplyWindowService,
  ],
  exports: [
    GtmCommandMaterializeService,
    GtmInboundReplyClassifierService,
    GtmOutreachThrottleService,
    GtmCompaniesCacheService,
    GtmPeopleCacheService,
    GtmWorkspaceProfileProvisioningService,
    EnsureGtmProjectService,
    SearchPeopleForCompanyService,
    LinkedinProviderIdStoreService,
    FetchLinkedinProfileService,
    FetchLinkedinMessagesService,
    FetchCompanyDetailsService,
    UploadProfilesService,
    UploadProfilesWorkflowResumeService,
    UpsertCompaniesService,
    EnrichContactService,
    GetCalendarAvailabilityService,
    GtmFakeProfileDetectorService,
    GtmFilterProfilesService,
    GtmOutreachMessagePersistService,
    GtmLogicFunctionNativeExecutor,
    GtmUnipilePacingService,
    GtmInboundReplyWindowService,
  ],
})
export class GtmCommandModule {}
