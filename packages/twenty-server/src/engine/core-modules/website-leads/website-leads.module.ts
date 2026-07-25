import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { ObjectMetadataEntity } from 'src/engine/metadata-modules/object-metadata/object-metadata.entity';
import { GlobalWorkspaceDataSourceModule } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-datasource.module';
import { WorkspaceEventEmitterModule } from 'src/engine/workspace-event-emitter/workspace-event-emitter.module';

import { CalendlyBookingCompletedService } from './calendly-booking-completed.service';
import { FreeTrialLeadCrmService } from './free-trial-lead-crm.service';
import { WebsiteLeadsController } from './website-leads.controller';
import { WebsiteLeadsService } from './website-leads.service';

@Module({
  imports: [
    EnvironmentModule,
    GlobalWorkspaceDataSourceModule,
    WorkspaceEventEmitterModule,
    TypeOrmModule.forFeature([ObjectMetadataEntity]),
  ],
  controllers: [WebsiteLeadsController],
  providers: [
    WebsiteLeadsService,
    FreeTrialLeadCrmService,
    CalendlyBookingCompletedService,
  ],
})
export class WebsiteLeadsModule {}
