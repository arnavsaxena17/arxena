import { Module, forwardRef } from '@nestjs/common';

import { UnipileCompanyService } from 'src/engine/core-modules/arx-chat/services/unipile-company.service';
import { UnipilePoolModule } from 'src/engine/core-modules/arx-chat/unipile-pool.module';
import { ApiKeyModule } from 'src/engine/core-modules/api-key/api-key.module';
import { CandidateSearchModule } from 'src/engine/core-modules/candidate-search/candidate-search.module';
import { CandidateSourcingModule } from 'src/engine/core-modules/candidate-sourcing/candidate-sourcing.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { GtmCommandController } from 'src/engine/core-modules/gtm-command/controllers/gtm-command.controller';
import { GtmInboundReplyWindowService } from 'src/engine/core-modules/gtm-command/jobs/gtm-inbound-reply-window.job';
import { GtmWorkspaceProfileBootstrapJob } from 'src/engine/core-modules/gtm-command/jobs/gtm-workspace-profile-bootstrap.job';
import { EnsureGtmProjectService } from 'src/engine/core-modules/gtm-command/services/ensure-gtm-project.service';
import { FetchLinkedinProfileService } from 'src/engine/core-modules/gtm-command/services/fetch-linkedin-profile.service';
import { GtmLogicFunctionNativeExecutor } from 'src/engine/core-modules/gtm-command/services/gtm-logic-function-native.executor';
import { GtmUnipilePacingService } from 'src/engine/core-modules/gtm-command/services/gtm-unipile-pacing.service';
import { SearchPeopleForCompanyService } from 'src/engine/core-modules/gtm-command/services/search-people-for-company.service';
import { PeopleApiModule } from 'src/engine/core-modules/people-api/people-api.module';
import { GtmCompaniesIndexWikiEnrichmentSource } from 'src/engine/core-modules/gtm-command/services/gtm-companies-index-wiki-enrichment.source';
import {
  GTM_COMPANY_ENRICHMENT_SOURCES,
  GtmCompanyEnrichmentCollectorService,
} from 'src/engine/core-modules/gtm-command/services/gtm-company-enrichment-collector.service';
import { GtmCompanyProfileSummarizerService } from 'src/engine/core-modules/gtm-command/services/gtm-company-profile-summarizer.service';
import { GtmCommandMaterializeService } from 'src/engine/core-modules/gtm-command/services/gtm-command-materialize.service';
import { GtmCompaniesCacheService } from 'src/engine/core-modules/gtm-command/services/gtm-companies-cache.service';
import { GtmLinkedInPoolCompanyEnrichmentSource } from 'src/engine/core-modules/gtm-command/services/gtm-linkedin-pool-company-enrichment.source';
import { GtmOutreachThrottleService } from 'src/engine/core-modules/gtm-command/services/gtm-outreach-throttle.service';
import { GtmPeopleCacheService } from 'src/engine/core-modules/gtm-command/services/gtm-people-cache.service';
import { GtmWikidataCompanyEnrichmentSource } from 'src/engine/core-modules/gtm-command/services/gtm-wikidata-company-enrichment.source';
import { GtmWebSearchCompanyEnrichmentSource } from 'src/engine/core-modules/gtm-command/services/gtm-web-search-company-enrichment.source';
import { GtmWorkspaceProfileProvisioningService } from 'src/engine/core-modules/gtm-command/services/gtm-workspace-profile-provisioning.service';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { LinkedInSearchModule } from 'src/engine/core-modules/linkedin-search/linkedin-search.module';
import { CompaniesEsService } from 'src/engine/core-modules/org-chart/services/companies-es.service';
import { WikidataModule } from 'src/engine/core-modules/wikidata/wikidata.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';

@Module({
  imports: [
    GraphQLExecutionModule,
    WorkspaceModificationsModule,
    CandidateSearchModule,
    LinkedInSearchModule,
    UnipilePoolModule,
    EnvironmentModule,
    WikidataModule,
    ApiKeyModule,
    PeopleApiModule,
    forwardRef(() => CandidateSourcingModule),
  ],
  controllers: [GtmCommandController],
  providers: [
    GtmCommandMaterializeService,
    GtmOutreachThrottleService,
    GtmCompaniesCacheService,
    GtmPeopleCacheService,
    CompaniesEsService,
    UnipileCompanyService,
    GtmCompaniesIndexWikiEnrichmentSource,
    GtmWikidataCompanyEnrichmentSource,
    GtmLinkedInPoolCompanyEnrichmentSource,
    GtmWebSearchCompanyEnrichmentSource,
    {
      provide: GTM_COMPANY_ENRICHMENT_SOURCES,
      useFactory: (
        wikiSource: GtmCompaniesIndexWikiEnrichmentSource,
        linkedInPoolSource: GtmLinkedInPoolCompanyEnrichmentSource,
        wikidataSource: GtmWikidataCompanyEnrichmentSource,
        webSearchSource: GtmWebSearchCompanyEnrichmentSource,
      ) => [
        // Order: companies ES (free_company_dataset) → LinkedIn autocomplete → Wikidata → website web_search
        wikiSource,
        linkedInPoolSource,
        wikidataSource,
        webSearchSource,
      ],
      inject: [
        GtmCompaniesIndexWikiEnrichmentSource,
        GtmLinkedInPoolCompanyEnrichmentSource,
        GtmWikidataCompanyEnrichmentSource,
        GtmWebSearchCompanyEnrichmentSource,
      ],
    },
    GtmCompanyEnrichmentCollectorService,
    GtmCompanyProfileSummarizerService,
    GtmWorkspaceProfileProvisioningService,
    GtmWorkspaceProfileBootstrapJob,
    EnsureGtmProjectService,
    SearchPeopleForCompanyService,
    FetchLinkedinProfileService,
    GtmLogicFunctionNativeExecutor,
    GtmUnipilePacingService,
    GtmInboundReplyWindowService,
  ],
  exports: [
    GtmCommandMaterializeService,
    GtmOutreachThrottleService,
    GtmCompaniesCacheService,
    GtmPeopleCacheService,
    GtmWorkspaceProfileProvisioningService,
    EnsureGtmProjectService,
    SearchPeopleForCompanyService,
    FetchLinkedinProfileService,
    GtmLogicFunctionNativeExecutor,
    GtmUnipilePacingService,
    GtmInboundReplyWindowService,
  ],
})
export class GtmCommandModule {}
