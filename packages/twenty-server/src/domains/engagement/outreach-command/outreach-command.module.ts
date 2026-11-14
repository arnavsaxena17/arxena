import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApifyModule } from 'src/domains/discovery/providers/apify/apify.module';
import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { AccountRateLimitModule } from 'src/engine/core-modules/account-rate-limit/account-rate-limit.module';
import { UnipileCompanyService } from 'src/engine/core-modules/arx-chat/services/unipile-company.service';
import { UnipilePoolModule } from 'src/engine/core-modules/arx-chat/unipile-pool.module';
import { ApiKeyModule } from 'src/engine/core-modules/api-key/api-key.module';
import { BrightDataModule } from 'src/domains/discovery/providers/bright-data/bright-data.module';
import { CandidateSearchModule } from 'src/domains/planning/candidate-search/candidate-search.module';
import { CandidateSourcingModule } from 'src/domains/ingestion/candidate-sourcing/candidate-sourcing.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { FeatureFlagModule } from 'src/engine/core-modules/feature-flag/feature-flag.module';
import { FileModule } from 'src/engine/core-modules/file/file.module';
import { OutreachCommandController } from 'src/domains/engagement/outreach-command/controllers/outreach-command.controller';
import { OutreachDecisionModule } from 'src/domains/engagement/outreach-command/outreach-decision.module';
import { OutreachMockController } from 'src/domains/engagement/outreach-command/controllers/outreach-mock.controller';
import { OutreachInboundReplyWindowService } from 'src/domains/engagement/outreach-command/jobs/outreach-inbound-reply-window.job';
import { OutreachInboundEmailListener } from 'src/domains/engagement/outreach-command/listeners/outreach-inbound-email.listener';
import { LinkedinProviderIdStoreService } from 'src/domains/engagement/outreach-command/services/linkedin-provider-id.store';
import { OutreachWorkspaceProfileBootstrapJob } from 'src/domains/engagement/outreach-command/jobs/outreach-workspace-profile-bootstrap.job';
import { EnsureOutreachProjectService } from 'src/domains/engagement/outreach-command/services/ensure-outreach-project.service';
import { FetchAndUpsertLocalBusinessesService } from 'src/domains/engagement/outreach-command/services/fetch-and-upsert-local-businesses.service';
import { ClassifyAndUpsertLocalPlacesService } from 'src/domains/engagement/outreach-command/services/classify-and-upsert-local-places.service';
import { FetchCompanyDetailsService } from 'src/domains/engagement/outreach-command/services/fetch-company-details.service';
import { FetchLinkedinMessagesService } from 'src/domains/engagement/outreach-command/services/fetch-linkedin-messages.service';
import { FetchLinkedinProfileService } from 'src/domains/engagement/outreach-command/services/fetch-linkedin-profile.service';
import { VisitLinkedinProfileService } from 'src/domains/engagement/outreach-command/services/visit-linkedin-profile.service';
import { FetchUserCommentsService } from 'src/domains/engagement/outreach-command/services/fetch-user-comments.service';
import { OutreachLogicFunctionNativeExecutor } from 'src/domains/engagement/outreach-command/services/outreach-logic-function-native.executor';
import { OutreachUnipilePacingService } from 'src/domains/engagement/outreach-command/services/outreach-unipile-pacing.service';
import { PlanLocalBusinessCityCoverageService } from 'src/domains/engagement/outreach-command/services/plan-local-business-city-coverage.service';
import { SearchPeopleForCompanyService } from 'src/domains/engagement/outreach-command/services/search-people-for-company.service';
import { SearchPeopleService } from 'src/domains/engagement/outreach-command/services/search-people.service';
import { SearchCompaniesService } from 'src/domains/engagement/outreach-command/services/search-companies.service';
import { SearchCrunchbaseCompaniesService } from 'src/domains/engagement/outreach-command/services/search-crunchbase-companies.service';
import { SearchJobsService } from 'src/domains/engagement/outreach-command/services/search-jobs.service';
import { SearchPostsService } from 'src/domains/engagement/outreach-command/services/search-posts.service';
import { UploadProfilesService } from 'src/domains/engagement/outreach-command/services/upload-profiles.service';
import { UploadProfilesWorkflowResumeService } from 'src/domains/engagement/outreach-command/services/upload-profiles-workflow-resume.service';
import { SaveOutreachTargetsToCrmService } from 'src/domains/engagement/outreach-command/services/save-outreach-targets-to-crm.service';
import { OutreachTabDedupeService } from 'src/domains/engagement/outreach-command/services/outreach-tab-dedupe.service';
import { OutreachTabExportService } from 'src/domains/engagement/outreach-command/services/outreach-tab-export.service';
import { UpsertCompaniesService } from 'src/domains/engagement/outreach-command/services/upsert-companies.service';
import { EnrichContactService } from 'src/domains/engagement/outreach-command/services/enrich-contact.service';
import { CreateReferralCandidateService } from 'src/domains/engagement/outreach-command/services/create-referral-candidate.service';
import { OutreachCopyCandidatesService } from 'src/domains/engagement/outreach-command/services/outreach-copy-candidates.service';
import { OutreachDraftTemplateService } from 'src/domains/engagement/outreach-command/services/outreach-draft-template.service';
import { NotifyMemberSystemEmailService } from 'src/domains/engagement/outreach-command/services/notify-member-system-email.service';
import { GetProjectAttachmentsService } from 'src/domains/engagement/outreach-command/services/get-project-attachments.service';
import { GetCalendarAvailabilityService } from 'src/domains/engagement/outreach-command/services/get-calendar-availability.service';
import { OutreachFakeProfileDetectorService } from 'src/domains/engagement/outreach-command/services/outreach-fake-profile-detector.service';
import { OutreachFilterProfilesService } from 'src/domains/engagement/outreach-command/services/outreach-filter-profiles.service';
import { OutreachMessagePersistService } from 'src/domains/engagement/outreach-command/services/outreach-message-persist.service';
import { OutreachMemberAssignmentService } from 'src/domains/engagement/outreach-command/services/outreach-member-assignment.service';
import { OutreachSendWaveAdmissionService } from 'src/domains/engagement/outreach-command/services/outreach-send-wave-admission.service';
import { OutreachCompanyDedupeService } from 'src/domains/engagement/outreach-command/services/outreach-company-dedupe.service';
import { OutreachWarmOverlapService } from 'src/domains/engagement/outreach-command/services/outreach-warm-overlap.service';
import { OutreachSenderProfileService } from 'src/domains/engagement/outreach-command/services/outreach-sender-profile.service';
import { QualifyProspectService } from 'src/domains/engagement/outreach-command/services/qualify-prospect.service';
import { LinkedinSelectionFetchService } from 'src/domains/engagement/outreach-command/services/linkedin-selection-fetch.service';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { OutreachCompaniesIndexWikiEnrichmentSource } from 'src/domains/engagement/outreach-command/services/outreach-companies-index-wiki-enrichment.source';
import {
  OUTREACH_COMPANY_ENRICHMENT_SOURCES,
  OutreachCompanyEnrichmentCollectorService,
} from 'src/domains/engagement/outreach-command/services/outreach-company-enrichment-collector.service';
import { OutreachCompanyProfileSummarizerService } from 'src/domains/engagement/outreach-command/services/outreach-company-profile-summarizer.service';
import { OutreachSpreadsheetMappingService } from 'src/domains/engagement/outreach-command/services/outreach-spreadsheet-mapping.service';
import { IcpBootstrapSummarizerService } from 'src/domains/engagement/outreach-command/services/outreach-icp-bootstrap-summarizer.service';
import { OutreachCommandMaterializeService } from 'src/domains/engagement/outreach-command/services/outreach-command-materialize.service';
import { OutreachMockLifecycleService } from 'src/domains/engagement/outreach-command/services/outreach-mock-lifecycle.service';
import { OutreachInboundReplyClassifierService } from 'src/domains/engagement/outreach-command/services/outreach-inbound-reply-classifier.service';
import { OutreachCompaniesCacheService } from 'src/domains/engagement/outreach-command/services/outreach-companies-cache.service';
import { OutreachLinkedInPoolCompanyEnrichmentSource } from 'src/domains/engagement/outreach-command/services/outreach-linkedin-pool-company-enrichment.source';
import { OutreachThrottleService } from 'src/domains/engagement/outreach-command/services/outreach-throttle.service';
import { ProcessOutreachAiColumnChunkJob } from 'src/domains/engagement/outreach-command/jobs/process-outreach-ai-column-chunk.job';
import { OutreachAiColumnRunService } from 'src/domains/engagement/outreach-command/services/outreach-ai-column-run.service';
import { OutreachTableViewService } from 'src/domains/engagement/outreach-command/services/outreach-table-view.service';
import { OutreachAiColumnService } from 'src/domains/engagement/outreach-command/services/outreach-ai-column.service';
import { ChatTabWritesService } from 'src/domains/engagement/outreach-command/services/chat-tab-writes.service';
import { SourcingBudgetService } from 'src/domains/engagement/outreach-command/services/sourcing-budget.service';
import { SourcingLedgerService } from 'src/domains/engagement/outreach-command/services/sourcing-ledger.service';
import { OutreachTabService } from 'src/domains/engagement/outreach-command/services/outreach-tab.service';
import { UndoChatOutreachService } from 'src/domains/engagement/outreach-command/services/undo-chat-outreach.service';
import { OutreachPeopleCacheService } from 'src/domains/engagement/outreach-command/services/outreach-people-cache.service';
import { OutreachProjectCacheBackupService } from 'src/domains/engagement/outreach-command/services/outreach-project-cache-backup.service';
import { OutreachProjectOutreachControlService } from 'src/domains/engagement/outreach-command/services/outreach-project-outreach-control.service';
import { OutreachCandidateJourneyService } from 'src/domains/engagement/outreach-command/services/outreach-candidate-journey.service';
import { OutreachDeferredResumeCronService } from 'src/domains/engagement/outreach-command/services/outreach-deferred-resume-cron.service';
import { OutreachDeferredResumeService } from 'src/domains/engagement/outreach-command/services/outreach-deferred-resume.service';
import { OutreachDeferredResumeJob } from 'src/domains/engagement/outreach-command/jobs/outreach-deferred-resume.job';
import { RefreshPendingHitlAfterPromptChangeJob } from 'src/domains/engagement/outreach-command/jobs/refresh-pending-hitl-after-prompt-change.job';
import { OutreachWorkflowRunFlowSyncService } from 'src/domains/engagement/outreach-command/services/outreach-workflow-run-flow-sync.service';
import { OutreachWorkflowRunRepairService } from 'src/domains/engagement/outreach-command/services/outreach-workflow-run-repair.service';
import { OutreachWikidataCompanyEnrichmentSource } from 'src/domains/engagement/outreach-command/services/outreach-wikidata-company-enrichment.source';
import { ArxWebSearchModule } from 'src/domains/discovery/providers/web-evidence/arx-web-search.module';
import { OutreachWebSearchCompanyEnrichmentSource } from 'src/domains/engagement/outreach-command/services/outreach-web-search-company-enrichment.source';
import { OutreachWorkspaceAuthTokenService } from 'src/domains/engagement/outreach-command/services/outreach-workspace-auth-token.service';
import { OutreachWorkspaceProfileProvisioningService } from 'src/domains/engagement/outreach-command/services/outreach-workspace-profile-provisioning.service';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { LinkedInSearchModule } from 'src/domains/discovery/transport/linkedin-search/linkedin-search.module';
import { LogicFunctionExecutorModule } from 'src/engine/core-modules/logic-function/logic-function-executor/logic-function-executor.module';
import { CompaniesEsService } from 'src/domains/org-graph/org-chart/services/companies-es.service';
import { WikidataModule } from 'src/domains/discovery/providers/wikidata/wikidata.module';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { ContactEnrichmentModule } from 'src/domains/discovery/providers/contact-enrichment/contact-enrichment.module';
import { GoogleContactsModule } from 'src/engine/core-modules/google-contacts/google-contacts.module';
import { OrgChartModule } from 'src/domains/org-graph/org-chart/org-chart.module';
import { GoogleCalendarModule } from 'src/engine/core-modules/calendar-events/google-calendar.module';
import { AiBillingModule } from 'src/engine/metadata-modules/ai/ai-billing/ai-billing.module';
import { WorkflowCommonModule } from 'src/modules/workflow/common/workflow-common.module';
import { WorkflowRunModule } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.module';
import { OutreachCacheRealtimeModule } from 'src/domains/engagement/outreach-command/outreach-cache-realtime.module';
import { MessagingModule } from 'src/engine/core-modules/arx-chat/messaging.module';
import { DiscoverySearchModule } from 'src/domains/discovery/search/search.module';
import { IcpExtractionService } from 'src/domains/engagement/outreach-command/icp-outreach/icp-extraction.service';
import { IcpOutreachMessageService } from 'src/domains/engagement/outreach-command/icp-outreach/icp-outreach-message.service';
import { LinkedinOutreachOpenerService } from 'src/domains/engagement/outreach-command/icp-outreach/linkedin-outreach-opener.service';
import { OrgChartOutreachController } from 'src/domains/engagement/outreach-command/icp-outreach/org-chart-outreach.controller';
import { OrgChartOutreachService } from 'src/domains/engagement/outreach-command/icp-outreach/org-chart-outreach.service';
// WorkflowRunnerModule is not imported here: it pulls ToolModule → OutreachCommand (cycle).
// Journey service resolves WorkflowRunnerWorkspaceService via ModuleRef instead.

@Module({
  imports: [
    DiscoverySearchModule,
    MessagingModule,
    TypeOrmModule.forFeature([WorkspaceEntity]),
    forwardRef(() => ArxWebSearchModule),
    AiBillingModule,
    GraphQLExecutionModule,
    AccountRateLimitModule,
    LogicFunctionExecutorModule,
    WorkspaceModificationsModule,
    forwardRef(() => CandidateSearchModule),
    forwardRef(() => LinkedInSearchModule),
    UnipilePoolModule,
    EnvironmentModule,
    FeatureFlagModule,
    FileModule,
    ApplicationModule,
    ApifyModule,
    WikidataModule,
    ApiKeyModule,
    JwtModule,
    forwardRef(() => CandidateSourcingModule),
    ContactEnrichmentModule,
    GoogleContactsModule,
    // ICP outreach reads org-chart services (super-impose autocomplete) and
    // candidates-sourcing; keep this a forwardRef since CandidateSourcing and
    // OutreachCommand already reference each other.
    forwardRef(() => OrgChartModule),
    GoogleCalendarModule,
    WorkflowCommonModule,
    WorkflowRunModule,
    OutreachDecisionModule,
    OutreachCacheRealtimeModule,
    BrightDataModule,
  ],
  controllers: [OutreachCommandController, OutreachMockController],
  providers: [
    OrgChartOutreachService,
    LinkedinOutreachOpenerService,
    IcpExtractionService,
    IcpOutreachMessageService,
    OutreachMemberAssignmentService,
    OutreachWarmOverlapService,
    OutreachCommandMaterializeService,
    OutreachMockLifecycleService,
    OutreachInboundReplyClassifierService,
    OutreachThrottleService,
    OutreachProjectCacheBackupService,
    OutreachCompaniesCacheService,
    OutreachPeopleCacheService,
    OutreachSpreadsheetMappingService,
    OutreachTabService,
    UndoChatOutreachService,
    SourcingLedgerService,
    SourcingBudgetService,
    ChatTabWritesService,
    OutreachAiColumnService,
    OutreachAiColumnRunService,
    OutreachTableViewService,
    ProcessOutreachAiColumnChunkJob,
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
    SearchCrunchbaseCompaniesService,
    SearchJobsService,
    SearchPostsService,
    LinkedinProviderIdStoreService,
    FetchLinkedinProfileService,
    VisitLinkedinProfileService,
    FetchLinkedinMessagesService,
    FetchUserCommentsService,
    FetchCompanyDetailsService,
    UploadProfilesService,
    UploadProfilesWorkflowResumeService,
    SaveOutreachTargetsToCrmService,
    OutreachTabDedupeService,
    OutreachTabExportService,
    UpsertCompaniesService,
    EnrichContactService,
    GetCalendarAvailabilityService,
    GetProjectAttachmentsService,
    NotifyMemberSystemEmailService,
    OutreachDraftTemplateService,
    CreateReferralCandidateService,
    OutreachCopyCandidatesService,
    OutreachFakeProfileDetectorService,
    OutreachFilterProfilesService,
    PlanLocalBusinessCityCoverageService,
    FetchAndUpsertLocalBusinessesService,
    ClassifyAndUpsertLocalPlacesService,
    OutreachMessagePersistService,
    OutreachLogicFunctionNativeExecutor,
    OutreachUnipilePacingService,
    OutreachSendWaveAdmissionService,
    OutreachCompanyDedupeService,
    OutreachProjectOutreachControlService,
    OutreachCandidateJourneyService,
    OutreachDeferredResumeService,
    OutreachDeferredResumeJob,
    OutreachDeferredResumeCronService,
    OutreachWorkflowRunFlowSyncService,
    OutreachWorkflowRunRepairService,
    RefreshPendingHitlAfterPromptChangeJob,
    OutreachInboundReplyWindowService,
    OutreachInboundEmailListener,
    OutreachSenderProfileService,
    QualifyProspectService,
    LinkedinSelectionFetchService,
  ],
  exports: [
    OrgChartOutreachService,
    IcpExtractionService,
    IcpOutreachMessageService,
    LinkedinOutreachOpenerService,
    OutreachMemberAssignmentService,
    OutreachCommandMaterializeService,
    OutreachInboundReplyClassifierService,
    OutreachThrottleService,
    OutreachCompaniesCacheService,
    OutreachPeopleCacheService,
    OutreachSpreadsheetMappingService,
    OutreachTabService,
    UndoChatOutreachService,
    SourcingLedgerService,
    SourcingBudgetService,
    ChatTabWritesService,
    OutreachAiColumnService,
    OutreachAiColumnRunService,
    OutreachTableViewService,
    OutreachWorkspaceProfileProvisioningService,
    EnsureOutreachProjectService,
    SearchPeopleForCompanyService,
    LinkedinProviderIdStoreService,
    FetchLinkedinProfileService,
    VisitLinkedinProfileService,
    FetchLinkedinMessagesService,
    FetchUserCommentsService,
    FetchCompanyDetailsService,
    UploadProfilesService,
    UploadProfilesWorkflowResumeService,
    SaveOutreachTargetsToCrmService,
    UpsertCompaniesService,
    EnrichContactService,
    GetCalendarAvailabilityService,
    GetProjectAttachmentsService,
    NotifyMemberSystemEmailService,
    OutreachDraftTemplateService,
    CreateReferralCandidateService,
    OutreachCopyCandidatesService,
    OutreachFakeProfileDetectorService,
    OutreachFilterProfilesService,
    PlanLocalBusinessCityCoverageService,
    FetchAndUpsertLocalBusinessesService,
    ClassifyAndUpsertLocalPlacesService,
    OutreachMessagePersistService,
    OutreachLogicFunctionNativeExecutor,
    OutreachUnipilePacingService,
    OutreachProjectOutreachControlService,
    OutreachCandidateJourneyService,
    OutreachDeferredResumeService,
    OutreachWorkflowRunFlowSyncService,
    OutreachWorkflowRunRepairService,
    OutreachInboundReplyWindowService,
    OutreachSenderProfileService,
    QualifyProspectService,
    LinkedinSelectionFetchService,
    OutreachTabDedupeService,
    OutreachTabExportService,
  ],
})
export class OutreachCommandModule {}
