import { ArxenaConfig } from '../config';

export type McpToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  openWorldHint?: boolean;
};

export interface McpTool {
  definition: {
    name: string;
    title?: string;
    description: string;
    annotations?: McpToolAnnotations;
    inputSchema: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
  handler: (args: Record<string, unknown>, config: ArxenaConfig) => Promise<unknown>;
}

export interface JobSummary {
  id: string;
  name: string;
  jobLocation?: string;
  jobCode?: string;
  isActive?: boolean;
  company?: { id: string; name: string };
  description?: string;
  salaryBracket?: string;
  yearsOfExperience?: string;
  createdAt?: string;
}

export interface CandidateSummary {
  id: string;
  name: string;
  status?: string;
  phoneNumber?: string;
  email?: string;
  jobTitle?: string;
  jobCompanyName?: string;
  engagementStatus?: boolean;
  remarks?: string;
  projectId?: string;
  jobName?: string;
  peopleId?: string;
  updatedAt?: string;
}

export interface PersonSummary {
  id: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  city?: string;
  salary?: string;
  jobTitle?: string;
  linkedinUrl?: string;
  candidates?: CandidateSummary[];
}

export interface CandidateFieldSummary {
  id: string;
  name: string;
  value?: string;
}
