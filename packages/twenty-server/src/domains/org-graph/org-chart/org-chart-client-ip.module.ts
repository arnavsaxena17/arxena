import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrgChartClientIpRuleEntity } from 'src/domains/org-graph/org-chart/org-chart-client-ip-rule.entity';
import { OrgChartClientIpService } from 'src/domains/org-graph/org-chart/services/org-chart-client-ip.service';

@Module({
  imports: [TypeOrmModule.forFeature([OrgChartClientIpRuleEntity])],
  providers: [OrgChartClientIpService],
  exports: [OrgChartClientIpService],
})
export class OrgChartClientIpModule {}
