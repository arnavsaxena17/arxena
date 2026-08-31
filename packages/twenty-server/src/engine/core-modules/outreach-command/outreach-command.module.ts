import { Module, forwardRef } from '@nestjs/common';

import { AccountRateLimitModule } from 'src/engine/core-modules/account-rate-limit/account-rate-limit.module';
import { UnipileCompanyService } from 'src/engine/core-modules/arx-chat/services/unipile-company.service';
import { UnipilePoolModule } from 'src/engine/core-modules/arx-chat/unipile-pool.module';
import { ApiKeyModule } from 'src/engine/core-modules/api-key/api-key.module';
import { CandidateSearchModule } from 'src/engine/core-modules/candidate-search/candidate-search.module';
import { CandidateSourcingModule } from 'src/engine/core-modules/candidate-sourcing/candidate-sourcing.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { OutreachCommandController } from 'src/engine/core-modules/outreach-command/controllers/outreach-command.controller';
import { OutreachInboundReplyWindowService } from 'src/engine/core-modules/outreach-command/jobs/outreach-inbound-reply-window.job';
import { LinkedinProviderIdStoreService } from 'src/engine/core-modules/outreach-command/services/linkedin-provider-id.store';
import { OutreachWorkspaceProfileBootstrapJob } from 'src/engine/core-modules/outreach-command/jobs/outreach-workspace-profile-bootstrap.job';
import { EnsureOutreachProjectService } from 'src/engine/core-modules/outreach-command/services/ensure-outreach-project.service';
import { FetchCompanyDetailsService } from 'src/engine/core-modules/outreach-command/services/fetch-company-details.service';
import { FetchLinkedinMessagesService } from 'src/engine/core-modules/outreach-command/services/fetch-linkedin-messages.service';
import { FetchLinkedinProfileService } from 'src/engine/core-modules/outreach-command/services/fetch-linkedin-profile.service';
import { OutreachLogicFunctionNativeExecutor } from 'src/engine/core-modules/outreach-command/services/outreach-logic-function-native.executor';
import { OutreachUnipilePacingService } from 'src/engine/core-modules/outreach-command/services/outreach-unipile-pacing.service';
import { SearchPeopleForCompanyService } from 'src/engine/core-modules/outreach-command/services/search-people-for-company.service';
import { SearchPeopleService } from 'src/engine/core-modules/outreach-command/services/search-people.service';
import { SearchCompaniesService } from 'src/engine/core-modules/outreach-command/services/search-companies.service';
import { SearchJobsService } from 'src/engine/core-modules/outreach-command/services/search-jobs.service';
import { SearchPostsService } from 'src/engine/core-modules/outreach-command/services/search-posts.service';
import { UploadProfilesService } from 'src/engine/core-modules/outreach-command/services/upload-profiles.service';
import { UploadProfilesWorkflowResumeService } from 'src/engine/core-modules/outreach-command/services/upload-profiles-workflow-resume.service';
import { UpsertCompaniesService } from 'src/engine/core-modules/outreach-command/services/upsert-companies.service';
import { EnrichContactService } from 'src/engine/core-modules/outreach-command/services/enrich-contact.service';
import { GetCalendarAvailabilityService } from 'src/engine/core-modules/outreach-command/services/get-calendar-availability.service';
import { OutreachFakeProfileDetectorService } from 'src/engine/core-modules/outreach-command/services/outreach-fake-profile-detector.service';
import { OutreachFilterProfilesService } from 'src/engine/core-modules/outreach-command/services/outreach-filter-profiles.service';
import { OutreachMessagePersistService } from 'src/engine/core-modules/outreach-command/services/outreach-message-persist.service';
import { PeopleApiModule } from 'src/engine/core-modules/people-api/people-api.module';
import { CompanyApiModule } from 'src/engine/core-modules/company-api/company-api.module';
import { JobsApiModule } from 'src/engine/core-modules/jobs-api/jobs-api.module';
import { PostsApiModule } from 'src/engine/core-modules/posts-api/posts-api.module';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { OutreachCompaniesIndexWikiEnrichmentSource } from 'src/engine/core-modules/outreach-command/services/outreach-companies-index-wiki-enrichment.source';
import {
  OUTREACH_COMPANY_ENRICHMENT_SOURCES,
  OutreachCompanyEnrichmentCollectorService,
} from 'src/engine/core-modules/outreach-command/services/outreach-company-enrichment-collector.service';
import { OutreachCompanyProfileSummarizerService } from 'src/engine/core-modules/outreach-command/services/outreach-company-profile-summarizer.service';
import { IcpBootstrapSummarizerService } from 'src/engine/core-modules/outreach-command/services/outreach-icp-bootstrap-summarizer.service';
import { OutreachCommandMaterializeService } from 'src/engine/core-modules/outreach-command/services/outreach-command-materialize.service';
import { OutreachInboundReplyClassifierService } from 'src/engine/core-modules/outreach-command/services/outreach-inbound-reply-classifier.service';
import { OutreachCompaniesCacheService } from 'src/engine/core-modules/outreach-command/services/outreach-companies-cache.service';
import { OutreachLinkedInPoolCompanyEnrichmentSource } from 'src/engine/core-modules/outreach-command/services/outreach-linkedin-pool-company-enrichment.source';
import { OutreachThrottleService } from 'src/engine/core-modules/outreach-command/services/outreach-throttle.service';
import { OutreachPeopleCacheService } from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';
import { OutreachProjectOutreachControlService } from 'src/engine/core-modules/outreach-command/services/outreach-project-outreach-control.service';
import { OutreachWikidataCompanyEnrichmentSource } from 'src/engine/core-modules/outreach-command/services/outreach-wikidata-company-enrichment.source';
import { OutreachWebSearchCompanyEnrichmentSource } from 'src/engine/core-modules/outreach-command/services/outreach-web-search-company-enrichment.source';
import { OutreachWorkspaceAuthTokenService } from 'src/engine/core-modules/outreach-command/services/outreach-workspace-auth-token.service';
import { OutreachWorkspaceProfileProvisioningService } from 'src/engine/core-modules/outreach-command/services/outreach-workspace-profile-provisioning.service';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { LinkedInSearchModule } from 'src/engine/core-modules/linkedin-search/linkedin-search.module';
import { LogicFunctionExecutorModule } from 'src/engine/core-modules/logic-function/logic-function-executor/logic-function-executor.module';
import { CompaniesEsService } from 'src/engine/core-modules/org-chart/services/companies-es.service';
import { WikidataModule } from 'src/engine/core-modules/wikidata/wikidata.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { ContactEnrichmentModule } from 'src/engine/core-modules/contact-enrichment/contact-enrichment.module';
import { GoogleCalendarModule } from 'src/engine/core-modules/calendar-events/google-calendar.module';
import { AiBillingModule } from 'src/engine/metadata-modules/ai/ai-billing/ai-billing.module';
import { WorkflowRunModule } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.module';

@Module({
  imports: [
    AiBillingModule,
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
  controllers: [OutreachCommandController],
  providers: [
    OutreachCommandMaterializeService,
    OutreachInboundReplyClassifierService,
    OutreachThrottleService,
    OutreachCompaniesCacheService,
    OutreachPeopleCacheService,
    CompaniesEsService,
    UnipileCompanyService,
    OutreachCompaniesIndexWikiEnrichmentSource,
    OutreachWikidataCompanyEnrichmentSource,
    OutreachLinkedInPoolCompanyEnrichmentSource,
    OutreachWebSearchCompanyEnrichmentSource,
    {
      provide: OUTREACH_COMPANY_ENRICHMENT_SOURCES,
      useFactory: (
        wikiSource: OutreachCompaniesIndexWikiEnrichmentSource,
        linkedInPoolSource: OutreachLinkedInPoolCompanyEnrichmentSource,
        wikidataSource: OutreachWikidataCompanyEnrichmentSource,
        webSearchSource: OutreachWebSearchCompanyEnrichmentSource,
      ) => [
        // Order: companies ES (free_company_dataset) → LinkedIn autocomplete → Wikidata → website web_search
        wikiSource,
        linkedInPoolSource,
        wikidataSource,
        webSearchSource,
      ],
      inject: [
        OutreachCompaniesIndexWikiEnrichmentSource,
        OutreachLinkedInPoolCompanyEnrichmentSource,
        OutreachWikidataCompanyEnrichmentSource,
        OutreachWebSearchCompanyEnrichmentSource,
      ],
    },
    OutreachCompanyEnrichmentCollectorService,
    OutreachCompanyProfileSummarizerService,
    IcpBootstrapSummarizerService,
    OutreachWorkspaceProfileProvisioningService,
    OutreachWorkspaceProfileBootstrapJob,
    OutreachWorkspaceAuthTokenService,
    EnsureOutreachProjectService,
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
    OutreachFakeProfileDetectorService,
    OutreachFilterProfilesService,
    OutreachMessagePersistService,
    OutreachLogicFunctionNativeExecutor,
    OutreachUnipilePacingService,
    OutreachProjectOutreachControlService,
    OutreachInboundReplyWindowService,
  ],
  exports: [
    OutreachCommandMaterializeService,
    OutreachInboundReplyClassifierService,
    OutreachThrottleService,
    OutreachCompaniesCacheService,
    OutreachPeopleCacheService,
    OutreachWorkspaceProfileProvisioningService,
    EnsureOutreachProjectService,
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
    OutreachFakeProfileDetectorService,
    OutreachFilterProfilesService,
    OutreachMessagePersistService,
    OutreachLogicFunctionNativeExecutor,
    OutreachUnipilePacingService,
    OutreachProjectOutreachControlService,
    OutreachInboundReplyWindowService,
  ],
})
export class OutreachCommandModule {}
