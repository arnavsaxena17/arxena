import { ParsedJD } from '../types/ParsedJD';

export type ProjectForParsedJDMerge = {
  id: string;
  name: string;
  pathPosition?: string;
  isActive: boolean;
  jobLocation?: string;
  assistantThread?: {
    edges?: Array<{
      node: {
        id: string;
        name: string;
        assistantParameters?: unknown;
        enrichmentConfigs?: unknown;
        columnFilters?: unknown;
      };
    }>;
  };
};

export const mergeParsedJDFromSources = ({
  projectId,
  projects,
  userData,
  modalMode,
  isModalOpen,
}: {
  projectId: string;
  projects: ProjectForParsedJDMerge[];
  userData: ParsedJD | null;
  modalMode: 'create' | 'edit';
  isModalOpen: boolean;
}): ParsedJD | null => {
  const job = projects.find(
    (projectItem) => projectItem.id === projectId,
  );

  const derivedFromJob: Partial<ParsedJD> | null = job
    ? ({
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
        parsedJobDescription: undefined,
        assistantThreads:
          job.assistantThread?.edges?.map((edge) => ({
            id: edge.node.id,
            name: edge.node.name,
            assistantParameters: edge.node.assistantParameters,
            enrichmentConfigs: edge.node.enrichmentConfigs,
            columnFilters: edge.node.columnFilters,
          })) || [],
      } as Partial<ParsedJD>)
    : null;

  if (modalMode === 'create' && isModalOpen) {
    return userData || null;
  }

  if (!job && !userData) {
    return null;
  }

  if (userData && derivedFromJob) {
    return { ...derivedFromJob, ...userData } as ParsedJD;
  }

  return (userData || (derivedFromJob as ParsedJD)) ?? null;
};
