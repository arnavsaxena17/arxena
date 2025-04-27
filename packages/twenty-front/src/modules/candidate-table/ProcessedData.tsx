import { CandidateNode } from "twenty-shared";

export const ProcessedData = ({ rawData, selectedRowIds }: { rawData: CandidateNode[], selectedRowIds: string[] }) => {
    if (!rawData.length) return [];
    // Process raw data to generate processed data
    return rawData.map(candidate => {
      const baseData = {
        id: candidate.id,
        name: candidate.name || 'N/A',
        phone: candidate?.phoneNumber || 'N/A',
        email: candidate?.email || 'N/A',
        status: candidate?.status || 'N/A',
        source: candidate?.source || 'N/A',
        checkbox: selectedRowIds.includes(candidate.id),
      };
      const fieldValues: Record<string, string> = {};
      if (candidate.candidateFieldValues?.edges) {
        candidate.candidateFieldValues.edges.forEach((edge: any) => {
          if (edge.node) {
            const fieldName = edge.node.candidateFields?.name;
            if (fieldName && edge.node.name !== undefined) {
              const camelCaseFieldName = fieldName.replace(/_([a-z])/g, (match: string, letter: string) => letter.toUpperCase());
              fieldValues[camelCaseFieldName] = edge.node.name;
            }
          }
        });
      }
      return { ...baseData, ...fieldValues };
    });
  };
