import { Module } from '@nestjs/common';

import { GtmCommandController } from 'src/engine/core-modules/gtm-command/controllers/gtm-command.controller';
import { GtmCommandMaterializeService } from 'src/engine/core-modules/gtm-command/services/gtm-command-materialize.service';
import { GtmCompaniesCacheService } from 'src/engine/core-modules/gtm-command/services/gtm-companies-cache.service';
import { GtmPeopleCacheService } from 'src/engine/core-modules/gtm-command/services/gtm-people-cache.service';
import { GtmOutreachThrottleService } from 'src/engine/core-modules/gtm-command/services/gtm-outreach-throttle.service';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';

@Module({
  imports: [GraphQLExecutionModule, WorkspaceModificationsModule],
  controllers: [GtmCommandController],
  providers: [
    GtmCommandMaterializeService,
    GtmOutreachThrottleService,
    GtmCompaniesCacheService,
    GtmPeopleCacheService,
  ],
  exports: [
    GtmCommandMaterializeService,
    GtmOutreachThrottleService,
    GtmCompaniesCacheService,
    GtmPeopleCacheService,
  ],
})
export class GtmCommandModule {}
