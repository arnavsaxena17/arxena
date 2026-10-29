import { Injectable } from '@nestjs/common';

import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { FindPeopleByCompanyTool } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-by-company-tool';
import {
  FIND_PEOPLE_CHUNK_JOB_NAME,
  type FindPeopleChunkJobData,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-run.service';

// Shares the AI filtering queue with the AI column runs (jobs are routed by
// name), one chunk of companies per job
@Processor(MessageQueue.aiFilteringQueue)
@Injectable()
export class ProcessFindPeopleChunkJob {
  constructor(
    private readonly findPeopleByCompanyTool: FindPeopleByCompanyTool,
  ) {}

  @Process(FIND_PEOPLE_CHUNK_JOB_NAME)
  async handle(jobData: FindPeopleChunkJobData): Promise<void> {
    await this.findPeopleByCompanyTool.processRunChunk(jobData.runId);
  }
}
