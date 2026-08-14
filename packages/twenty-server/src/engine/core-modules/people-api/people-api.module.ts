import { Module } from '@nestjs/common';

import { UnipilePoolModule } from 'src/engine/core-modules/arx-chat/unipile-pool.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { BillingModule } from 'src/engine/core-modules/billing/billing.module';
import { CandidateSearchModule } from 'src/engine/core-modules/candidate-search/candidate-search.module';
import { SerpCompanySearchModule } from 'src/engine/core-modules/linkedin-company-search/linkedin-company-search.module';
import { LinkedInSearchModule } from 'src/engine/core-modules/linkedin-search/linkedin-search.module';
import { OrgChartModule } from 'src/engine/core-modules/org-chart/org-chart.module';
import { ThrottlerModule } from 'src/engine/core-modules/throttler/throttler.module';
import { TwentyConfigModule } from 'src/engine/core-modules/twenty-config/twenty-config.module';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

import { PeopleApiController } from './people-api.controller';
import { PeopleApiService } from './people-api.service';
import { PeopleCompanyScopeResolver } from './services/people-company-scope.resolver';
import { PeopleLinkedInSourcingService } from './services/people-linkedin-sourcing.service';
import { PeopleLocationScopeResolver } from './services/people-location-scope.resolver';
import { PeopleNaturalLanguageParserService } from './services/people-natural-language-parser.service';
import { PeopleSalesNavAccountResolver } from './services/people-sales-nav-account.resolver';

@Module({
  imports: [
    OrgChartModule,
    SerpCompanySearchModule,
    CandidateSearchModule,
    LinkedInSearchModule,
    UnipilePoolModule,
    AuthModule,
    BillingModule,
    WorkspaceCacheStorageModule,
    ThrottlerModule,
    TwentyConfigModule,
  ],
  controllers: [PeopleApiController],
  providers: [
    PeopleApiService,
    PeopleCompanyScopeResolver,
    PeopleLocationScopeResolver,
    PeopleNaturalLanguageParserService,
    PeopleLinkedInSourcingService,
    PeopleSalesNavAccountResolver,
    JwtAuthGuard,
  ],
  exports: [PeopleApiService],
})
export class PeopleApiModule {}
