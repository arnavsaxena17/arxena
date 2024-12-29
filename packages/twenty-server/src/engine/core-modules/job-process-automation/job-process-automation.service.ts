import { Injectable } from '@nestjs/common';
import * as JobProcessTypes from './types/job-process-automation.types';

@Injectable()
export class JobProcessAutomationService {
    private jobProcess: any[] = [];

    async createJobProcess(data: JobProcessTypes.JobProcess): Promise<{ message: string; jobProcess: JobProcessTypes.JobProcess[] }> {
        this.jobProcess.push(data);
        return { message: 'Job process created', jobProcess: this.jobProcess };
    }


    async modifyJobProcess(data: JobProcessTypes.JobProcessModificationsType): Promise<{ message: string; data?: JobProcessTypes.JobProcessModificationsType }> {
        const jobProcessModificationsIndex = this.jobProcess.findIndex(job => job.jobId === data.jobId);
        if (jobProcessModificationsIndex === -1) {
            return { message: 'Job process not found' };
        }
        const jobProcess = this.jobProcess[jobProcessModificationsIndex];
        switch (data.JobProcessModifications.JobProcessModificationType) {
            case 'ADD':
                if (data.JobProcessModifications.JobProcessModificationStage) {
                    jobProcess.stages.push(data.JobProcessModifications.JobProcessModificationStage);
                }
                break;
            case 'REMOVE':
                if (data.JobProcessModifications) {
                    jobProcess.stages.splice(jobProcessModificationsIndex, 1);
                }
                break;
            case 'UPDATE':
                if (data.JobProcessModifications && data.JobProcessModifications.JobProcessModificationStage) {
                    jobProcess.stages[jobProcessModificationsIndex] = data.JobProcessModifications.JobProcessModificationStage;
                }
                break;
            default:
                return { message: 'Invalid modification type' };
        }

        this.jobProcess[jobProcessModificationsIndex] = jobProcess;
        return { message: 'Job process modified', data };
    }

    async viewJobProcess(): Promise<any> {
        return { message: 'Current job process', jobProcess: this.jobProcess };
    }
}
