import { Module, forwardRef } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { BrightDataBusinessSearchController } from 'src/engine/core-modules/bright-data/controllers/bright-data-business-search.controller';
import { BrightDataBusinessSearchService } from 'src/engine/core-modules/bright-data/services/bright-data-business-search.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

import { BrightDataGoogleMapsPlacesService } from './services/bright-data-google-maps-places.service';
import { BrightDataLinkedinProfileScrapeService } from './services/bright-data-linkedin-profile-scrape.service';
import { BrightDataLinkedinPeopleSearchService } from './services/bright-data-linkedin-people-search.service';
import { BrightDataResidentialProxyService } from './services/bright-data-residential-proxy.service';
import { BrightDataSerpService } from './services/bright-data-serp.service';
import { BrightDataUnlockerService } from './services/bright-data-unlocker.service';

@Module({
  imports: [
    AuthModule,
    WorkspaceCacheStorageModule,
    forwardRef(() => {
      // ToolModule → OrgChart → TheOfficialBoard reads BrightDataModule while
      // this file is still initializing. Lazy require waits until the class exists.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../tool/tool.module').ToolModule;
    }),
  ],
  controllers: [BrightDataBusinessSearchController],
  providers: [
    JwtAuthGuard,
    BrightDataResidentialProxyService,
    BrightDataSerpService,
    BrightDataUnlockerService,
    BrightDataLinkedinPeopleSearchService,
    BrightDataLinkedinProfileScrapeService,
    BrightDataGoogleMapsPlacesService,
    BrightDataBusinessSearchService,
  ],
  exports: [
    BrightDataResidentialProxyService,
    BrightDataSerpService,
    BrightDataUnlockerService,
    BrightDataLinkedinPeopleSearchService,
    BrightDataLinkedinProfileScrapeService,
    BrightDataGoogleMapsPlacesService,
    BrightDataBusinessSearchService,
  ],
})
export class BrightDataModule {}
