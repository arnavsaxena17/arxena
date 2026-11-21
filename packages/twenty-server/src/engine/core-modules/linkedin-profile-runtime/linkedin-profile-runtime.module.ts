import { Module } from '@nestjs/common';

import { UnipilePoolModule } from 'src/engine/core-modules/arx-chat/unipile-pool.module';
import { FeatureFlagModule } from 'src/engine/core-modules/feature-flag/feature-flag.module';
import { FetchLinkedinProfileService } from 'src/engine/core-modules/linkedin-profile-runtime/services/fetch-linkedin-profile.service';
import { LinkedinProviderIdStoreService } from 'src/engine/core-modules/linkedin-profile-runtime/services/linkedin-provider-id.store';
import { UploadProfilesWorkflowResumeService } from 'src/engine/core-modules/linkedin-profile-runtime/services/upload-profiles-workflow-resume.service';
import { WorkflowRunModule } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.module';

// Profile fetching, the LinkedIn provider-id store, and upload-correlation
// sessions sit below both CandidateSourcingModule and OutreachCommandModule.
// Keeping them here means the two command modules no longer import each other.
// Every provider must also be exported: OutreachCommandModule imports this leaf
// and re-exports it so tool / arx-chat reach these without a second copy.
@Module({
  imports: [UnipilePoolModule, FeatureFlagModule, WorkflowRunModule],
  providers: [
    FetchLinkedinProfileService,
    UploadProfilesWorkflowResumeService,
    LinkedinProviderIdStoreService,
  ],
  exports: [
    FetchLinkedinProfileService,
    UploadProfilesWorkflowResumeService,
    LinkedinProviderIdStoreService,
  ],
})
export class LinkedinProfileRuntimeModule {}
