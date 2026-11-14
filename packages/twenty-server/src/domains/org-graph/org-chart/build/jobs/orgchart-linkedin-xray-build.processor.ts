import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { OrgChartLinkedInBuildService } from 'src/domains/org-graph/org-chart/services/org-chart-linkedin-build.service';

import type { OrgchartLinkedinXrayBuildJobData } from 'src/domains/org-graph/org-chart/build/jobs/orgchart-linkedin-xray-build.types';

@Processor(MessageQueue.orgchartApifyQueue)
export class OrgchartLinkedinXrayBuildProcessor {
  constructor(
    private readonly orgChartLinkedInBuildService: OrgChartLinkedInBuildService,
  ) {}

  @Process({ jobName: OrgchartLinkedinXrayBuildProcessor.name, concurrency: 1 })
  async handle(jobData: OrgchartLinkedinXrayBuildJobData): Promise<void> {
    await this.orgChartLinkedInBuildService.handleLinkedinXrayOrgChartJob(
      jobData,
    );
  }
}
