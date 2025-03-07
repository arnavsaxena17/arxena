import { Injectable } from '@nestjs/common';

import { JobProcess, JobProcessModificationsType } from 'twenty-shared';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class JobProcessAutomationService {
  private jobProcess: JobProcess[] = [];

  async createJobProcess(
    data: JobProcess,
  ): Promise<{ message: string; jobProcess: JobProcess[] }> {
    this.jobProcess.push(data);

    return { message: 'Job process created', jobProcess: this.jobProcess };
  }

  async modifyJobProcess(
    data: JobProcessModificationsType,
  ): Promise<{ message: string; data?: JobProcessModificationsType }> {
    const jobProcessModificationsIndex = this.jobProcess.findIndex(
      (job) => job.jobId === data.jobId,
    );

    if (jobProcessModificationsIndex === -1) {
      return { message: 'Job process not found' };
    }
    const jobProcess = this.jobProcess[jobProcessModificationsIndex];

    switch (data.JobProcessModifications.JobProcessModificationType) {
      case 'ADD':
        if (data.JobProcessModifications.JobProcessModificationStage) {
          jobProcess.stages.push({
            ...data.JobProcessModifications.JobProcessModificationStage,
            id: uuidv4(),
          });
        }
        break;
      case 'REMOVE':
        if (data.JobProcessModifications) {
          jobProcess.stages.splice(jobProcessModificationsIndex, 1);
        }
        break;
      case 'UPDATE':
        if (
          data.JobProcessModifications &&
          data.JobProcessModifications.JobProcessModificationStage
        ) {
          jobProcess.stages[jobProcessModificationsIndex] = {
            ...data.JobProcessModifications.JobProcessModificationStage,
            id: jobProcess.stages[jobProcessModificationsIndex].id,
          };
        }
        break;
      default:
        return { message: 'Invalid modification type' };
    }

    this.jobProcess[jobProcessModificationsIndex] = jobProcess;

    return { message: 'Job process modified', data };
  }

  async viewJobProcess(): Promise<{
    message: string;
    jobProcess: JobProcess[];
  }> {
    return { message: 'Current job process', jobProcess: this.jobProcess };
  }
}
