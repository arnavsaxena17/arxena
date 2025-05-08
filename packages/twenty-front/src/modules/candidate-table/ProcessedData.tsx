import { CandidateNode } from "twenty-shared";

export const ProcessedData = ({ rawData, selectedRowIds }: { rawData: CandidateNode[], selectedRowIds: string[] }) => {
    if (!rawData.length) return [];
    // Process raw data to generate processed data
    return rawData.map(candidate => {
      const baseData = {

        id: candidate?.id,
        personId: candidate?.people?.id,
        name: candidate?.name || 'N/A',
        phone: candidate?.people?.phones?.primaryPhoneNumber || 'N/A',
        email: candidate?.people?.emails?.primaryEmail || 'N/A',
        status: candidate?.status || 'N/A',
        source: candidate?.source || 'N/A',
        checkbox: selectedRowIds.includes(candidate?.id || ''),
        startChat: candidate?.startChat || false,
        startChatCompleted: candidate?.startChatCompleted || false,
        engagementStatus: candidate?.engagementStatus || 'N/A',
        startMeetingSchedulingChat: candidate?.startMeetingSchedulingChat || false,
        startMeetingSchedulingChatCompleted: candidate?.startMeetingSchedulingChatCompleted || false,
        startVideoInterviewChat: candidate?.startVideoInterviewChat || false,
        startVideoInterviewChatCompleted: candidate?.startVideoInterviewChatCompleted || false,
        stopChat: candidate?.stopChat || false,
        stopChatCompleted: candidate?.stopChatCompleted || false,
        stopVideoInterviewChat: candidate?.stopVideoInterviewChat || false,
        stopVideoInterviewChatCompleted: candidate?.stopVideoInterviewChatCompleted || false,
        messagingChannel: candidate?.messagingChannel || 'N/A',
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
      // console.log("Field Values", fieldValues);
      const processedData = {  ...fieldValues, ...baseData };
      return processedData;
    });
  };
