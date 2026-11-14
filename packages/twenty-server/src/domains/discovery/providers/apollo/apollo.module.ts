import { Module, forwardRef } from '@nestjs/common';

import { CacheStorageModule } from 'src/engine/core-modules/cache-storage/cache-storage.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { RawFetchArchiveModule } from 'src/engine/core-modules/raw-fetch-archive/raw-fetch-archive.module';

import { ApolloIoRestService } from './services/apollo-io-rest.service';
import { ApolloPeopleSearchTransformerService } from './services/apollo-people-search-transformer.service';

@Module({
  imports: [
    CacheStorageModule,
    EnvironmentModule,
    RawFetchArchiveModule,
    // ApolloPeopleSearchTransformerService reuses LinkedInSearchTransformerService
    // (table rows + metadata) from CandidateSourcing. Lazy require: CandidateSearch
    // imports this module directly, so a static import here would cycle at file eval.
    forwardRef(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../../../ingestion/candidate-sourcing/candidate-sourcing.module')
        .CandidateSourcingModule;
    }),
  ],
  providers: [ApolloIoRestService, ApolloPeopleSearchTransformerService],
  exports: [ApolloIoRestService, ApolloPeopleSearchTransformerService],
})
export class ApolloProviderModule {}
