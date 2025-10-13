import { jobIdAtom, jobsState } from '@/candidate-table/states/states';
import { atom, selector } from 'recoil';
import { ParsedJD } from '../types/ParsedJD';
import { arxUploadJDModalModeState } from './arxUploadJDModalOpenState';

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

    // In create mode, don't derive data from existing job
    if (modalMode === 'create') {
      return userData;
    }

    const job = jobs.find(j => j.id === jobId);

    if (!job && !userData) {
      return null;
    }

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
          searchParameters: job.searchFilter?.edges?.map(edge => ({
            generatedSearchParameters: edge.node.searchFilterParameter?.generatedSearchParameters || null,
            resolvedSearchParameters: edge.node.searchFilterParameter?.resolvedSearchParameters || null,
          })) || [],
          searchFilters: job.searchFilter?.edges?.map(edge => ({
            id: edge.node.id,
            name: edge.node.name,
            searchFilterParameter: edge.node.searchFilterParameter,
            searchFilterName: edge.node.searchFilterName,
            searchFilterFields: edge.node.searchFilterFields,
          })) || [],
          chatFlow: undefined as any,
          videoInterview: undefined as any,
          meetingScheduling: undefined as any,
          existingChatQuestions: undefined as any,
        }
      : null;

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
