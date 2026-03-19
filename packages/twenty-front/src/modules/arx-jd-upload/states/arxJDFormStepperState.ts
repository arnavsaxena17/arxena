import { jobIdAtom, jobsState } from '@/candidate-table/states/states';
import { atom, selector } from 'recoil';
import { ParsedJD } from '../types/ParsedJD';
import { arxUploadJDModalModeState, isArxUploadJDModalOpenState } from './arxUploadJDModalOpenState';

export enum ArxJDFormStepType {
  UploadJD = 'uploadJD',
  JobDetails = 'jobDetails',
  CandidateSearch = 'candidateSearch',
  ChatConfiguration = 'chatConfiguration',
  VideoInterview = 'videoInterview',
  MeetingScheduling = 'meetingScheduling',
}

export type ArxJDFormStepperState = {
  activeStep: number;
};
export const arxJDFormStepperState = atom<ArxJDFormStepperState>({
  key: 'arxJDFormStepperState',
  default: {
    activeStep: 0,
  },
});

// Internal atom for storing user/AI-populated data - exported for job state reset
export const parsedJDInternalState = atom<ParsedJD | null>({
  key: 'parsedJDInternalState',
  default: null,
});

// Single source of truth: Writable selector that merges job data with user/AI data
// - get: returns merged ParsedJD where user/AI data overrides derived job fields
// - set: stores user/AI data in internal state
export const parsedJDSelector = selector<ParsedJD | null>({
  key: 'parsedJDSelector',
  get: ({ get }) => {
    const jobId = get(jobIdAtom);
    const jobs = get(jobsState);
    const userData = get(parsedJDInternalState);
    const modalMode = get(arxUploadJDModalModeState);
    const isModalOpen = get(isArxUploadJDModalOpenState);

    const job = jobs.find(j => j.id === jobId);

    const derivedFromJob: Partial<ParsedJD> | null = job
      ? {
          id: job.id,
          name: job.name,
          description: '',
          jobCode: '',
          jobLocation: job.jobLocation || '',
          salaryBracket: '',
          isActive: job.isActive,
          specificCriteria: '',
          pathPosition: job.pathPosition || '',
          companyName: '',
          companyId: '',
          companyDetails: '',
          filePath: '',
          parsedJobDescription: undefined as any,
          assistantThreads: (job as any).assistantThread?.edges?.map((edge: any) => ({
            id: edge.node.id,
            name: edge.node.name,
            assistantParameters: edge.node.assistantParameters,
            enrichmentConfigs: edge.node.enrichmentConfigs,
            columnFilters: edge.node.columnFilters,
          })) || [],
          chatFlow: undefined as any,
          videoInterview: undefined as any,
          meetingScheduling: undefined as any,
          existingChatQuestions: undefined as any,
        }
      : null;

    // In create mode while the modal is open, we should never derive from an existing job
    if (modalMode === 'create' && isModalOpen) {
      return userData || null;
    }

    // If no job found and no user data, return null
    if (!job && !userData) {
      return null;
    }

    // Merge precedence: user/AI data overrides derived job data
    if (userData && derivedFromJob) {
      return { ...derivedFromJob, ...userData } as ParsedJD;
    }
    
    return (userData || (derivedFromJob as ParsedJD)) ?? null;
  },
  set: ({ set }, newValue) => {
    set(parsedJDInternalState, newValue as ParsedJD | null);
  },
});

// Keep the old uploadedJDState for backward compatibility during transition
// TODO: Remove this after migration is complete
export type UploadedJDState = {
  jobCode: string;
  jobName: string;
  jobDescription: string;
  jobLocation: string;
  jobSalary: string;
};
