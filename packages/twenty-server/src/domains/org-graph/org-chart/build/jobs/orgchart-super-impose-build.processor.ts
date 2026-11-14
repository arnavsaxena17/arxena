import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { OrgChartLinkedInBuildService } from 'src/domains/org-graph/org-chart/services/org-chart-linkedin-build.service';

import type { OrgchartSuperImposeBuildJobData } from 'src/domains/org-graph/org-chart/build/jobs/orgchart-super-impose-build.types';

@Processor(MessageQueue.orgchartApifyQueue)
export class OrgchartSuperImposeBuildProcessor {
  constructor(
    private readonly orgChartLinkedInBuildService: OrgChartLinkedInBuildService,
  ) {}

  @Process({ jobName: OrgchartSuperImposeBuildProcessor.name, concurrency: 1 })
  async handle(jobData: OrgchartSuperImposeBuildJobData): Promise<void> {
    await this.orgChartLinkedInBuildService.handleSuperImposeOrgChartJob(
      jobData,
    );
  }
}
