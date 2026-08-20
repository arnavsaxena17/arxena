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
import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { FieldMetadataModule } from 'src/engine/metadata-modules/field-metadata/field-metadata.module';
import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { GlobalWorkspaceDataSourceModule } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-datasource.module';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { ArxenaStandardMetadataModule } from 'src/engine/workspace-manager/arxena-standard-metadata/arxena-standard-metadata.module';
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
    StandardObjectsPrefillModule,
    FieldMetadataModule,
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
  ],
})
export class V2_25_UpgradeVersionCommandModule {}
