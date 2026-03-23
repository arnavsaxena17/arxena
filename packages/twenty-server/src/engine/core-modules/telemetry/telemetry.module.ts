import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { TelemetryService } from './telemetry.service';

@Module({
  providers: [TelemetryService],
  imports: [
    HttpModule.register({
      baseURL: 'https://app.arxena.com/api/v2',
    }),
  ],
  exports: [TelemetryService],
})
export class TelemetryModule {}
