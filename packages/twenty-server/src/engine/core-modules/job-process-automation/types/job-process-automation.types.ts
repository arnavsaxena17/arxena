export interface JobProcessModificationsType {
  jobId: string;
  JobProcessModifications: { JobProcessModificationType: 'ADD' | 'REMOVE' | 'UPDATE'; JobProcessModificationStage?:JobProcessStage  };
}


export interface JobProcess {
    jobId: string;
    clientId: string;
    JobProcessStages: JobProcessStage[];
}

export interface JobProcessStage {
    JobProcessStageName: 'APPLICATION' | 'INTERVIEW' | 'OFFER' | 'ONBOARDING';
    JobProcessStageStatus: 'PENDING' | 'COMPLETED' | 'IN_PROGRESS';
}


