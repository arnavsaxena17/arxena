import { Body, Controller, Post } from '@nestjs/common';

import { JobProcess, JobProcessModificationsType } from 'twenty-shared';

import { JobProcessAutomationService } from './job-process-automation.service';

@Controller('job-process')
export class JobProcessAutomationController {
  constructor(
    private readonly jobProcessAutomationService: JobProcessAutomationService,
  ) {}

  @Post('create')
  async createJobProcessEndpoint(
    @Body() data: JobProcess,
  ): Promise<{ message: string; jobProcess: JobProcess[] }> {
    return this.jobProcessAutomationService.createJobProcess(data);
  }

  @Post('view')
  async viewJobProcessEndpoint(): Promise<{
    message: string;
    jobProcess: JobProcess[];
  }> {
    return this.jobProcessAutomationService.viewJobProcess();
  }

  @Post('modify')
  async modifyJobProcessEndpoint(
    @Body() data: JobProcessModificationsType,
  ): Promise<{ message: string; data?: JobProcessModificationsType }> {
    return this.jobProcessAutomationService.modifyJobProcess(data);
  }
}
