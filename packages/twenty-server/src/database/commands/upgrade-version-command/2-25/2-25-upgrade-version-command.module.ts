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
import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { GlobalWorkspaceDataSourceModule } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-datasource.module';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { ArxenaStandardMetadataModule } from 'src/engine/workspace-manager/arxena-standard-metadata/arxena-standard-metadata.module';
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
  ],
})
export class V2_25_UpgradeVersionCommandModule {}
