import { Module } from '@nestjs/common';

import { ClientGeoResolutionService } from 'src/engine/core-modules/geo/client-geo-resolution.service';
import { IpInfoGeoService } from 'src/engine/core-modules/geo/ip-info-geo.service';

@Module({
  providers: [IpInfoGeoService, ClientGeoResolutionService],
  exports: [IpInfoGeoService, ClientGeoResolutionService],
})
export class GeoModule {}
