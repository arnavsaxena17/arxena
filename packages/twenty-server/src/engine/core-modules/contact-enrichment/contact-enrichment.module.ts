import { Module, OnModuleInit } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { CacheStorageModule } from 'src/engine/core-modules/cache-storage/cache-storage.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { MessageQueueModule } from 'src/engine/core-modules/message-queue/message-queue.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { ContactEnrichmentController } from './controllers/contact-enrichment.controller';
import { ContactEnrichmentQueueProcessor } from './jobs/process-contact-enrichment.job';
import { ApolloProvider } from './providers/apollo.provider';
import { ArxenaProvider } from './providers/arxena.provider';
import { ContactOutProvider } from './providers/contactout.provider';
import { LushaProvider } from './providers/lusha.provider';
import { PdlProvider } from './providers/pdl.provider';
import { ContactAvailabilityCacheService } from './services/contact-availability-cache.service';
import { ContactEnrichmentJobService } from './services/contact-enrichment-job.service';
import { ContactEnrichmentWaterfallService } from './services/contact-enrichment-waterfall.service';
import { RateLimiterService } from './services/rate-limiter.service';

@Module({
  imports: [
    AuthModule,
    CacheStorageModule,
    EnvironmentModule,
    JwtModule,
    MessageQueueModule,
    WorkspaceCacheStorageModule,
  ],
  controllers: [ContactEnrichmentController],
  providers: [
    // Providers
    ArxenaProvider,
    PdlProvider,
    ContactOutProvider,
    LushaProvider,
    ApolloProvider,
    // Services
    RateLimiterService,
    ContactAvailabilityCacheService,
    ContactEnrichmentWaterfallService,
    ContactEnrichmentJobService,
    // Job processor
    ContactEnrichmentQueueProcessor,
  ],
  exports: [
    ContactEnrichmentWaterfallService,
    ContactEnrichmentJobService,
  ],
})
export class ContactEnrichmentModule implements OnModuleInit {
  constructor(
    private readonly waterfallService: ContactEnrichmentWaterfallService,
    private readonly arxenaProvider: ArxenaProvider,
    private readonly pdlProvider: PdlProvider,
    private readonly contactOutProvider: ContactOutProvider,
    private readonly lushaProvider: LushaProvider,
    private readonly apolloProvider: ApolloProvider,
  ) {}

  onModuleInit() {
    // Set providers in waterfall service after all providers are instantiated
    this.waterfallService.setProviders([
      this.arxenaProvider,
      this.pdlProvider,
      this.contactOutProvider,
      this.lushaProvider,
      this.apolloProvider,
    ]);
  }
}
