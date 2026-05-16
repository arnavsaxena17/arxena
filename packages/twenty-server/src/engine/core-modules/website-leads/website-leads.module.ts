import { Module } from '@nestjs/common';

import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';

import { WebsiteLeadsController } from './website-leads.controller';
import { WebsiteLeadsService } from './website-leads.service';

@Module({
  imports: [EnvironmentModule],
  controllers: [WebsiteLeadsController],
  providers: [WebsiteLeadsService],
})
export class WebsiteLeadsModule {}
