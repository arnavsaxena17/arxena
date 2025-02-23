import { Body, Controller, Post } from '@nestjs/common';
import { JobProcessAutomationService } from './job-process-automation.service';
import * as JobProcessTypes from './types/job-process-automation.types';

@Controller('job-process')
export class JobProcessAutomationController {
    constructor(
        private readonly jobProcessAutomationService: JobProcessAutomationService
    ) {}

    @Post('create')
    async createJobProcessEndpoint(@Body() data: JobProcessTypes.JobProcess): Promise<any> {
        return this.jobProcessAutomationService.createJobProcess(data);
    }

    @Post('view')
    async viewJobProcessEndpoint(): Promise<any> {
        return this.jobProcessAutomationService.viewJobProcess();
    }

    @Post('modify')
    async modifyJobProcessEndpoint(@Body() data: JobProcessTypes.JobProcessModificationsType): Promise<any> {
        return this.jobProcessAutomationService.modifyJobProcess(data);
    }
}



