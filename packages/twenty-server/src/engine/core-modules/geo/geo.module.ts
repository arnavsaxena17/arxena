import { Module } from '@nestjs/common';

import { ClickHouseService } from 'src/database/clickHouse/clickHouse.service';
import { OrgChartClientIpModule } from 'src/engine/core-modules/org-chart/org-chart-client-ip.module';
import { ClientGeoResolutionService } from 'src/engine/core-modules/geo/client-geo-resolution.service';
import { IpCompanyResolutionService } from 'src/engine/core-modules/geo/ip-company-resolution.service';
import { IpInfoGeoService } from 'src/engine/core-modules/geo/ip-info-geo.service';
import { RapidApiIpResolverService } from 'src/engine/core-modules/geo/rapid-api-ip-resolver.service';
import { VisitorCompanyResolutionController } from 'src/engine/core-modules/geo/visitor-company-resolution.controller';
import { VisitorCompanyResolutionService } from 'src/engine/core-modules/geo/visitor-company-resolution.service';

@Module({
  imports: [OrgChartClientIpModule],
  providers: [
    ClickHouseService,
    IpInfoGeoService,
    ClientGeoResolutionService,
    IpCompanyResolutionService,
    RapidApiIpResolverService,
    VisitorCompanyResolutionService,
  ],
  controllers: [VisitorCompanyResolutionController],
  exports: [
    ClickHouseService,
    IpInfoGeoService,
    ClientGeoResolutionService,
    IpCompanyResolutionService,
    RapidApiIpResolverService,
    VisitorCompanyResolutionService,
  ],
})
export class GeoModule {}
