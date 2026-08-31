import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkspaceIteratorModule } from 'src/database/commands/command-runners/workspace-iterator.module';
import { BackfillMessageListMembersJunctionTargetCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1784567000000-backfill-message-list-members-junction-target.command';
import { EnsureArxWorkspaceIndexesCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000006-ensure-arx-workspace-indexes.command';
import { AddArxenaRecordActionCommandMenuItemsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000007-add-arxena-record-action-command-menu-items.command';
import { BackfillLinkedinSearchSkillCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000008-backfill-linkedin-search-skill.command';
import { BackfillIcpOnboardingSkillCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000012-backfill-gtm-icp-onboarding-skill.command';
import { SyncOutreachCompanySkillContentCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000013-sync-gtm-company-skill-content.command';
import { SyncOutreachPeopleSkillContentCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000014-sync-gtm-people-skill-content.command';
import { SyncOutreachWorkflowSkillContentCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000015-sync-gtm-outreach-workflow-skill-content.command';
import { SyncOutreachWorkspaceProfileSkillContentCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000016-sync-gtm-workspace-profile-skill-content.command';
import { SyncIcpScopedRegenerateSkillContentCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000017-sync-gtm-icp-scoped-regenerate-skill-content.command';
import { RenameOutreachWorkspaceProfileToWorkspaceProfileCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000018-rename-gtm-workspace-profile-to-workspace-profile.command';
import { SyncWebsiteTrackerStandardObjectsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000021-sync-website-tracker-standard-objects.command';
import { SyncWorkflowBuildingFormHitlSkillContentCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000022-sync-workflow-building-form-hitl-skill-content.command';
import { SyncWorkflowBuildingCreateCompleteSchemaSkillContentCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000023-sync-workflow-building-create-complete-schema-skill-content.command';
import { BackfillOutreachWorkflowsSkillCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000024-backfill-gtm-outreach-workflows-skill.command';
import { EnsureOutreachSearchLogicFunctionsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000025-ensure-gtm-search-logic-functions.command';
import { EnsureOutreachFetchLogicFunctionsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000026-ensure-gtm-fetch-logic-functions.command';
import { SyncOutreachLogicFunctionSampleOutputCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000027-sync-gtm-logic-function-sample-output.command';
import { EnsureOutreachUploadProfilesLogicFunctionCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000028-ensure-gtm-upload-profiles-logic-function.command';
import { OutreachMessageFieldsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000029-gtm-outreach-message-fields.command';
import { SyncOutreachWorkflowsSkillContentCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000030-sync-gtm-outreach-workflows-skill-content.command';
import { RenameWhatsappMessageToChatMessageCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000031-rename-whatsapp-message-to-chat-message.command';
import { DropUnusedArxenaCrmObjectsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000032-drop-unused-arxena-crm-objects.command';
import { SyncOutreachSearchCompaniesUrlInputCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000033-sync-gtm-search-companies-url-input.command';
import { SyncWorkflowBuilderCompositionSkillContentCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000034-sync-workflow-builder-composition-skill-content.command';
import { SyncOutreachSequencerSkillContentCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000035-sync-gtm-sequencer-skill-content.command';
import { EnsureOutreachSequencerLogicFunctionsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000036-ensure-gtm-sequencer-logic-functions.command';
import { SyncOutreachSequencerSkillRecipesCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000037-sync-gtm-sequencer-skill-recipes.command';
import { PrefillOutreachWorkflowsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000038-prefill-gtm-outreach-workflows.command';
import { ResyncOutreachWorkflowGraphsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000039-resync-gtm-outreach-workflow-graphs.command';
import { ResyncOutreachWhatsappFormDetailsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000040-resync-gtm-outreach-whatsapp-form-details.command';
import { MergeOutreachCandidateUpdatedWorkflowsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000041-merge-gtm-outreach-candidate-updated-workflows.command';
import { ResyncOutreachSelectFiltersAndHarvestQueryCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000042-resync-gtm-outreach-select-filters-and-harvest-query.command';
import { SyncOutreachSearchCompaniesDropSortParamsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000043-sync-gtm-search-companies-drop-sort-params.command';
import { SyncOutreachSearchCompaniesParameterAutocompleteCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000044-sync-gtm-search-companies-parameter-autocomplete.command';
import { SyncOutreachCompanyHarvestFieldsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000045-sync-gtm-company-harvest-fields.command';
import { SyncOutreachProjectIdRecordPickerCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000046-sync-gtm-project-id-record-picker.command';
import { DropOutreachProjectRateLimitFieldsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000047-drop-gtm-project-rate-limit-fields.command';
import { EnsureOutreachDetectFakeProfilesLogicFunctionCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000048-ensure-gtm-detect-fake-profiles-logic-function.command';
import { DropIcpBlurbFieldsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000049-drop-gtm-icp-blurb-fields.command';
import { DropOutreachVanityFieldsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000050-drop-gtm-vanity-fields.command';
import { DropCandidateFieldObjectsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000051-drop-candidate-field-objects.command';
import { TransferVideoInterviewApplicationCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000052-transfer-video-interview-application.command';
import { UninstallVideoInterviewApplicationByDefaultCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000053-uninstall-video-interview-application-by-default.command';
import { TransferShortlistPresentationApplicationCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000054-transfer-shortlist-presentation-application.command';
import { FoldPromptsIntoProjectCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000055-fold-prompts-into-project.command';
import { TransferAssistantApplicationCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000056-transfer-assistant-application.command';
import { PrefillOutreachCommandDashboardCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000057-prefill-gtm-command-dashboard.command';
import { BackfillOutreachCommandRollupsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000058-backfill-gtm-command-rollups.command';
import { HealOutreachDashboardPageLayoutIdCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000078-heal-outreach-dashboard-page-layout-id.command';
import { SyncOutreachFetchLinkedinProfilePeopleOutputCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000059-sync-gtm-fetch-linkedin-profile-people-output.command';
import { SyncOutreachSearchPeopleHideDataSourceAccountIdCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000060-sync-gtm-search-people-hide-data-source-account-id.command';
import { SyncOutreachSearchPeopleForCompanyJobTitleCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000061-sync-gtm-search-people-for-company-job-title.command';
import { EnsureOutreachFilterProfilesLogicFunctionCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000062-ensure-gtm-filter-profiles-logic-function.command';
import { SyncOutreachSearchPeopleSearchUrlCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000063-sync-gtm-search-people-search-url.command';
import { SyncOutreachSearchPeopleProfileFieldsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000064-sync-gtm-search-people-profile-fields.command';
import { AddWorkflowRunRelatedRecordFieldsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000065-add-workflow-run-related-record-fields.command';
import { UniqueCompanyLinkedinIdCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000066-unique-company-linkedin-id.command';
import { SyncOutreachFilterProfilesOnlyOnePersonPerCompanyCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000067-sync-gtm-filter-profiles-only-one-person-per-company.command';
import { ResyncOutreachPerCandidateOnePersonPerCompanyCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000068-resync-gtm-per-candidate-one-person-per-company.command';
import { SyncOutreachProjectSendWindowFieldsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000069-sync-gtm-project-send-window-fields.command';
import { AddWorkflowRunProgressFieldsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000070-add-workflow-run-progress-fields.command';
import { AddCandidateWorkflowRunsRelationCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000071-add-candidate-workflow-runs-relation.command';
import { BackfillWorkflowRunRelatedRecordsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000072-backfill-workflow-run-related-records.command';
import { UnifyLlmIntentSkillsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000073-unify-llm-intent-skills.command';
import { RenameOutreachSeededOutreachWorkflowNamesCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000074-rename-gtm-seeded-outreach-workflow-names.command';
import { RenameGtmFieldsToOutreachCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000075-rename-gtm-fields-to-outreach.command';
import { AddWorkflowVersionExperimentStatusCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000077-add-workflow-version-experiment-status.command';
import { RenameIcpSpecBuyerTitlesToTargetTitlesCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000079-rename-icp-spec-buyer-titles-to-target-titles.command';
import { RenamePerEnrolledPersonToPerEnrolledCandidateCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000080-rename-per-enrolled-person-to-per-enrolled-candidate.command';
import { SyncOutreachWorkflowInventoryCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000081-sync-outreach-workflow-inventory.command';
import { SyncOutreachProjectSendWindowDaysFieldCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000082-sync-gtm-project-send-window-days-field.command';
import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { MigrateOtherFieldsService } from 'src/engine/core-modules/candidate-sourcing/services/migrate-other-fields.service';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { FieldMetadataModule } from 'src/engine/metadata-modules/field-metadata/field-metadata.module';
import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { GlobalWorkspaceDataSourceModule } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-datasource.module';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { WorkspaceDataSourceModule } from 'src/engine/workspace-datasource/workspace-datasource.module';
import { ArxenaStandardMetadataModule } from 'src/engine/workspace-manager/arxena-standard-metadata/arxena-standard-metadata.module';
import { AssistantApplicationModule } from 'src/engine/workspace-manager/assistant-application/assistant-application.module';
import { ShortlistPresentationApplicationModule } from 'src/engine/workspace-manager/shortlist-presentation-application/shortlist-presentation-application.module';
import { VideoInterviewApplicationModule } from 'src/engine/workspace-manager/video-interview-application/video-interview-application.module';
import { StandardObjectsPrefillModule } from 'src/engine/workspace-manager/standard-objects-prefill-data/standard-objects-prefill.module';
import { WorkspaceMigrationModule } from 'src/engine/workspace-manager/workspace-migration/workspace-migration.module';
import { WorkspaceMigrationRunnerModule } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-runner/workspace-migration-runner.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FieldMetadataEntity]),
    WorkspaceIteratorModule,
    GlobalWorkspaceDataSourceModule,
    ApplicationModule,
    WorkspaceCacheModule,
    WorkspaceMigrationModule,
    WorkspaceMigrationRunnerModule,
    ArxenaStandardMetadataModule,
    VideoInterviewApplicationModule,
    ShortlistPresentationApplicationModule,
    AssistantApplicationModule,
    StandardObjectsPrefillModule,
    FieldMetadataModule,
    WorkspaceModificationsModule,
    WorkspaceDataSourceModule,
  ],
  providers: [
    BackfillMessageListMembersJunctionTargetCommand,
    EnsureArxWorkspaceIndexesCommand,
    AddArxenaRecordActionCommandMenuItemsCommand,
    BackfillLinkedinSearchSkillCommand,
    BackfillIcpOnboardingSkillCommand,
    SyncOutreachCompanySkillContentCommand,
    SyncOutreachPeopleSkillContentCommand,
    SyncOutreachWorkflowSkillContentCommand,
    SyncOutreachWorkspaceProfileSkillContentCommand,
    SyncIcpScopedRegenerateSkillContentCommand,
    RenameOutreachWorkspaceProfileToWorkspaceProfileCommand,
    SyncWebsiteTrackerStandardObjectsCommand,
    SyncWorkflowBuildingFormHitlSkillContentCommand,
    SyncWorkflowBuildingCreateCompleteSchemaSkillContentCommand,
    BackfillOutreachWorkflowsSkillCommand,
    EnsureOutreachSearchLogicFunctionsCommand,
    EnsureOutreachFetchLogicFunctionsCommand,
    SyncOutreachLogicFunctionSampleOutputCommand,
    EnsureOutreachUploadProfilesLogicFunctionCommand,
    OutreachMessageFieldsCommand,
    SyncOutreachWorkflowsSkillContentCommand,
    RenameWhatsappMessageToChatMessageCommand,
    DropUnusedArxenaCrmObjectsCommand,
    SyncOutreachSearchCompaniesUrlInputCommand,
    SyncWorkflowBuilderCompositionSkillContentCommand,
    SyncOutreachSequencerSkillContentCommand,
    EnsureOutreachSequencerLogicFunctionsCommand,
    SyncOutreachSequencerSkillRecipesCommand,
    PrefillOutreachWorkflowsCommand,
    ResyncOutreachWorkflowGraphsCommand,
    ResyncOutreachWhatsappFormDetailsCommand,
    MergeOutreachCandidateUpdatedWorkflowsCommand,
    ResyncOutreachSelectFiltersAndHarvestQueryCommand,
    SyncOutreachSearchCompaniesDropSortParamsCommand,
    SyncOutreachSearchCompaniesParameterAutocompleteCommand,
    SyncOutreachCompanyHarvestFieldsCommand,
    SyncOutreachProjectIdRecordPickerCommand,
    DropOutreachProjectRateLimitFieldsCommand,
    EnsureOutreachDetectFakeProfilesLogicFunctionCommand,
    DropIcpBlurbFieldsCommand,
    DropOutreachVanityFieldsCommand,
    TransferVideoInterviewApplicationCommand,
    UninstallVideoInterviewApplicationByDefaultCommand,
    TransferShortlistPresentationApplicationCommand,
    FoldPromptsIntoProjectCommand,
    TransferAssistantApplicationCommand,
    PrefillOutreachCommandDashboardCommand,
    HealOutreachDashboardPageLayoutIdCommand,
    BackfillOutreachCommandRollupsCommand,
    SyncOutreachFetchLinkedinProfilePeopleOutputCommand,
    SyncOutreachSearchPeopleHideDataSourceAccountIdCommand,
    SyncOutreachSearchPeopleForCompanyJobTitleCommand,
    EnsureOutreachFilterProfilesLogicFunctionCommand,
    SyncOutreachSearchPeopleSearchUrlCommand,
    SyncOutreachSearchPeopleProfileFieldsCommand,
    AddWorkflowRunRelatedRecordFieldsCommand,
    UniqueCompanyLinkedinIdCommand,
    SyncOutreachFilterProfilesOnlyOnePersonPerCompanyCommand,
    ResyncOutreachPerCandidateOnePersonPerCompanyCommand,
    SyncOutreachProjectSendWindowFieldsCommand,
    AddWorkflowRunProgressFieldsCommand,
    AddCandidateWorkflowRunsRelationCommand,
    BackfillWorkflowRunRelatedRecordsCommand,
    UnifyLlmIntentSkillsCommand,
    RenameOutreachSeededOutreachWorkflowNamesCommand,
    RenameGtmFieldsToOutreachCommand,
    AddWorkflowVersionExperimentStatusCommand,
    RenameIcpSpecBuyerTitlesToTargetTitlesCommand,
    RenamePerEnrolledPersonToPerEnrolledCandidateCommand,
    SyncOutreachWorkflowInventoryCommand,
    SyncOutreachProjectSendWindowDaysFieldCommand,
    MigrateOtherFieldsService,
    DropCandidateFieldObjectsCommand,
  ],
})
export class V2_25_UpgradeVersionCommandModule {}
