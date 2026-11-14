import { Module, forwardRef } from '@nestjs/common';

import { UnipilePoolModule } from 'src/engine/core-modules/arx-chat/unipile-pool.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { BillingModule } from 'src/engine/core-modules/billing/billing.module';
import { ThrottlerModule } from 'src/engine/core-modules/throttler/throttler.module';
import { TwentyConfigModule } from 'src/engine/core-modules/twenty-config/twenty-config.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { BrightDataModule } from 'src/domains/discovery/providers/bright-data/bright-data.module';
import { DiscoveryQueryModule } from 'src/domains/discovery/query/query.module';
import { TitleTaxonomyModule } from 'src/domains/discovery/query/title-taxonomy/title-taxonomy.module';
import { SerpCompanySearchModule } from 'src/domains/discovery/providers/serp-company-search/serp-company-search.module';
import { LinkedInSearchModule } from 'src/domains/discovery/transport/linkedin-search/linkedin-search.module';
import { OrgChartModule } from 'src/domains/org-graph/org-chart/org-chart.module';
import { CandidateSearchModule } from 'src/domains/planning/candidate-search/candidate-search.module';

import { CompanyApiController } from './company-api/company-api.controller';
import { CompanySearchHitTransformer } from './company-api/services/company-search-hit.transformer';
import { EntitySearchDataSourceResolver } from './core/search-data-source';
import { EntitySearchService } from './core/entity-search.service';
import { JobsApiController } from './jobs-api/jobs-api.controller';
import { JobSearchHitTransformer } from './jobs-api/services/job-search-hit.transformer';
import { PeopleApiController } from './people-api/people-api.controller';
import { PeopleApiService } from './people-api/people-api.service';
import { PeopleCompanyScopeResolver } from './people-api/services/people-company-scope.resolver';
import { PeopleLinkedInSourcingService } from './people-api/services/people-linkedin-sourcing.service';
import { PeopleLocationScopeResolver } from './people-api/services/people-location-scope.resolver';
import { PeopleNaturalLanguageParserService } from './people-api/services/people-natural-language-parser.service';
import { PeopleSalesNavAccountResolver } from './people-api/services/people-sales-nav-account.resolver';
import { PeopleSearchDataSourceResolver } from './people-api/services/people-search-data-source.resolver';
import { PostsApiController } from './posts-api/posts-api.controller';
import { PostSearchHitTransformer } from './posts-api/services/post-search-hit.transformer';

// One module for entity search. Previously four modules (people/company/jobs/posts)
// each imported the same six platform modules and registered the same guard, and
// jobs/posts/company each carried their own copy of the data-source resolver.
@Module({
  imports: [
    forwardRef(() => OrgChartModule),
    forwardRef(() => CandidateSearchModule),
    DiscoveryQueryModule,
    TitleTaxonomyModule,
    BrightDataModule,
    SerpCompanySearchModule,
    LinkedInSearchModule,
    UnipilePoolModule,
    AuthModule,
    BillingModule,
    WorkspaceCacheStorageModule,
    ThrottlerModule,
    TwentyConfigModule,
    WorkspaceModificationsModule,
  ],
  controllers: [
    PeopleApiController,
    CompanyApiController,
    JobsApiController,
    PostsApiController,
  ],
  providers: [
    EntitySearchDataSourceResolver,
    EntitySearchService,
    JobSearchHitTransformer,
    PostSearchHitTransformer,
    CompanySearchHitTransformer,
    PeopleApiService,
    PeopleCompanyScopeResolver,
    PeopleLocationScopeResolver,
    PeopleNaturalLanguageParserService,
    PeopleLinkedInSourcingService,
    PeopleSalesNavAccountResolver,
    PeopleSearchDataSourceResolver,
    JwtAuthGuard,
  ],
  exports: [EntitySearchService, PeopleApiService, CompanySearchHitTransformer],
})
export class DiscoverySearchModule {}
