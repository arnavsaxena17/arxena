export interface PromptTemplate {
  system: string;
  user: string;
  variables?: Record<string, any>;
}

export interface JobDescriptionParsingPrompt {
  system: string;
  user: string;
}

export interface SearchParameterGenerationPrompt {
  system: string;
  user: string;
}

export interface CandidateSearchPrompts {
  jobDescriptionParsing: JobDescriptionParsingPrompt;
  classicPeopleSearchGeneration: SearchParameterGenerationPrompt;
  classicCompaniesSearchGeneration: SearchParameterGenerationPrompt;
  classicJobsSearchGeneration: SearchParameterGenerationPrompt;
  salesNavigatorPeopleSearchGeneration: SearchParameterGenerationPrompt;
  salesNavigatorCompaniesSearchGeneration: SearchParameterGenerationPrompt;
  recruiterPeopleSearchGeneration: SearchParameterGenerationPrompt;
}

export interface PromptContext {
  jobDescription: string;
  jobTitle?: string;
  company?: string;
  location?: string;
  industry?: string;
  parsedJobDescription?: any;
}
