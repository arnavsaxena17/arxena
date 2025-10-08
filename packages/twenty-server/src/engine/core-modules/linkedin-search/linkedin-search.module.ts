import { Module } from '@nestjs/common';
import { EnvironmentModule } from '../environment/environment.module';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { LinkedInSearchController } from './controllers/linkedin-search.controller';
import { LinkedInRequestTrackerService } from './services/linkedin-request-tracker.service';
import { LinkedInSearchService } from './services/linkedin-search.service';

@Module({
  imports: [EnvironmentModule, WorkspaceModificationsModule],
  controllers: [LinkedInSearchController],
  providers: [LinkedInSearchService, LinkedInRequestTrackerService],
  exports: [LinkedInSearchService],
})
export class LinkedInSearchModule {}
