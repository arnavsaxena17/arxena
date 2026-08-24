import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkspaceIteratorModule } from 'src/database/commands/command-runners/workspace-iterator.module';
import { BackfillMessageListMembersJunctionTargetCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1784567000000-backfill-message-list-members-junction-target.command';
import { EnsureArxWorkspaceIndexesCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000006-ensure-arx-workspace-indexes.command';
import { AddArxenaRecordActionCommandMenuItemsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000007-add-arxena-record-action-command-menu-items.command';
import { BackfillLinkedinSearchSkillCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000008-backfill-linkedin-search-skill.command';
import { BackfillGtmIcpOnboardingSkillCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000012-backfill-gtm-icp-onboarding-skill.command';
import { SyncGtmCompanySkillContentCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000013-sync-gtm-company-skill-content.command';
import { SyncGtmPeopleSkillContentCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000014-sync-gtm-people-skill-content.command';
import { SyncGtmOutreachWorkflowSkillContentCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000015-sync-gtm-outreach-workflow-skill-content.command';
import { SyncGtmWorkspaceProfileSkillContentCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000016-sync-gtm-workspace-profile-skill-content.command';
import { SyncGtmIcpScopedRegenerateSkillContentCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000017-sync-gtm-icp-scoped-regenerate-skill-content.command';
import { RenameGtmWorkspaceProfileToWorkspaceProfileCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000018-rename-gtm-workspace-profile-to-workspace-profile.command';
import { SyncWebsiteTrackerStandardObjectsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000021-sync-website-tracker-standard-objects.command';
import { SyncWorkflowBuildingFormHitlSkillContentCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000022-sync-workflow-building-form-hitl-skill-content.command';
import { SyncWorkflowBuildingCreateCompleteSchemaSkillContentCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000023-sync-workflow-building-create-complete-schema-skill-content.command';
import { BackfillGtmOutreachWorkflowsSkillCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000024-backfill-gtm-outreach-workflows-skill.command';
import { EnsureGtmSearchLogicFunctionsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000025-ensure-gtm-search-logic-functions.command';
import { EnsureGtmFetchLogicFunctionsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000026-ensure-gtm-fetch-logic-functions.command';
import { SyncGtmLogicFunctionSampleOutputCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000027-sync-gtm-logic-function-sample-output.command';
import { EnsureGtmUploadProfilesLogicFunctionCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000028-ensure-gtm-upload-profiles-logic-function.command';
import { GtmOutreachMessageFieldsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000029-gtm-outreach-message-fields.command';
import { SyncGtmOutreachWorkflowsSkillContentCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000030-sync-gtm-outreach-workflows-skill-content.command';
import { RenameWhatsappMessageToChatMessageCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000031-rename-whatsapp-message-to-chat-message.command';
import { DropUnusedArxenaCrmObjectsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000032-drop-unused-arxena-crm-objects.command';
import { SyncGtmSearchCompaniesUrlInputCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000033-sync-gtm-search-companies-url-input.command';
import { SyncWorkflowBuilderCompositionSkillContentCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000034-sync-workflow-builder-composition-skill-content.command';
import { SyncGtmSequencerSkillContentCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000035-sync-gtm-sequencer-skill-content.command';
import { EnsureGtmSequencerLogicFunctionsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000036-ensure-gtm-sequencer-logic-functions.command';
import { SyncGtmSequencerSkillRecipesCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000037-sync-gtm-sequencer-skill-recipes.command';
import { PrefillGtmOutreachWorkflowsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000038-prefill-gtm-outreach-workflows.command';
import { ResyncGtmOutreachWorkflowGraphsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000039-resync-gtm-outreach-workflow-graphs.command';
import { ResyncGtmOutreachWhatsappFormDetailsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000040-resync-gtm-outreach-whatsapp-form-details.command';
import { MergeGtmOutreachCandidateUpdatedWorkflowsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000041-merge-gtm-outreach-candidate-updated-workflows.command';
import { ResyncGtmOutreachSelectFiltersAndHarvestQueryCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000042-resync-gtm-outreach-select-filters-and-harvest-query.command';
import { SyncGtmSearchCompaniesDropSortParamsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000043-sync-gtm-search-companies-drop-sort-params.command';
import { SyncGtmSearchCompaniesParameterAutocompleteCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000044-sync-gtm-search-companies-parameter-autocomplete.command';
import { SyncGtmCompanyHarvestFieldsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000045-sync-gtm-company-harvest-fields.command';
import { SyncGtmProjectIdRecordPickerCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000046-sync-gtm-project-id-record-picker.command';
import { DropGtmProjectRateLimitFieldsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000047-drop-gtm-project-rate-limit-fields.command';
import { EnsureGtmDetectFakeProfilesLogicFunctionCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000048-ensure-gtm-detect-fake-profiles-logic-function.command';
import { DropGtmIcpBlurbFieldsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000049-drop-gtm-icp-blurb-fields.command';
import { DropGtmVanityFieldsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000050-drop-gtm-vanity-fields.command';
import { DropCandidateFieldObjectsCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000051-drop-candidate-field-objects.command';
import { TransferVideoInterviewApplicationCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000052-transfer-video-interview-application.command';
import { UninstallVideoInterviewApplicationByDefaultCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000053-uninstall-video-interview-application-by-default.command';
import { TransferShortlistPresentationApplicationCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000054-transfer-shortlist-presentation-application.command';
import { FoldPromptsIntoProjectCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000055-fold-prompts-into-project.command';
import { TransferAssistantApplicationCommand } from 'src/database/commands/upgrade-version-command/2-25/2-25-workspace-command-1785600000056-transfer-assistant-application.command';
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
    BackfillGtmIcpOnboardingSkillCommand,
    SyncGtmCompanySkillContentCommand,
    SyncGtmPeopleSkillContentCommand,
    SyncGtmOutreachWorkflowSkillContentCommand,
    SyncGtmWorkspaceProfileSkillContentCommand,
    SyncGtmIcpScopedRegenerateSkillContentCommand,
    RenameGtmWorkspaceProfileToWorkspaceProfileCommand,
    SyncWebsiteTrackerStandardObjectsCommand,
    SyncWorkflowBuildingFormHitlSkillContentCommand,
    SyncWorkflowBuildingCreateCompleteSchemaSkillContentCommand,
    BackfillGtmOutreachWorkflowsSkillCommand,
    EnsureGtmSearchLogicFunctionsCommand,
    EnsureGtmFetchLogicFunctionsCommand,
    SyncGtmLogicFunctionSampleOutputCommand,
    EnsureGtmUploadProfilesLogicFunctionCommand,
    GtmOutreachMessageFieldsCommand,
    SyncGtmOutreachWorkflowsSkillContentCommand,
    RenameWhatsappMessageToChatMessageCommand,
    DropUnusedArxenaCrmObjectsCommand,
    SyncGtmSearchCompaniesUrlInputCommand,
    SyncWorkflowBuilderCompositionSkillContentCommand,
    SyncGtmSequencerSkillContentCommand,
    EnsureGtmSequencerLogicFunctionsCommand,
    SyncGtmSequencerSkillRecipesCommand,
    PrefillGtmOutreachWorkflowsCommand,
    ResyncGtmOutreachWorkflowGraphsCommand,
    ResyncGtmOutreachWhatsappFormDetailsCommand,
    MergeGtmOutreachCandidateUpdatedWorkflowsCommand,
    ResyncGtmOutreachSelectFiltersAndHarvestQueryCommand,
    SyncGtmSearchCompaniesDropSortParamsCommand,
    SyncGtmSearchCompaniesParameterAutocompleteCommand,
    SyncGtmCompanyHarvestFieldsCommand,
    SyncGtmProjectIdRecordPickerCommand,
    DropGtmProjectRateLimitFieldsCommand,
    EnsureGtmDetectFakeProfilesLogicFunctionCommand,
    DropGtmIcpBlurbFieldsCommand,
    DropGtmVanityFieldsCommand,
    TransferVideoInterviewApplicationCommand,
    UninstallVideoInterviewApplicationByDefaultCommand,
    TransferShortlistPresentationApplicationCommand,
    FoldPromptsIntoProjectCommand,
    TransferAssistantApplicationCommand,
    MigrateOtherFieldsService,
    DropCandidateFieldObjectsCommand,
  ],
})
export class V2_25_UpgradeVersionCommandModule {}
