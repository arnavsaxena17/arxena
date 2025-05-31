import { CandidateNode } from "twenty-shared";

export const ProcessedData = ({ rawData, selectedRowIds }: { rawData: CandidateNode[], selectedRowIds: string[] }) => {
    if (!rawData.length) return [];
    return rawData.map(candidate => {
      const baseData = {
        id: candidate?.id,
        personId: candidate?.people?.id,
        name: candidate?.name || '',
        phone: candidate?.people?.phones?.primaryPhoneNumber || '',
        email: candidate?.people?.emails?.primaryEmail || '',
        candConversationStatus: candidate?.candConversationStatus || 'No Conversation',
        source: candidate?.source || 'N/A',
        checkbox: selectedRowIds.includes(candidate?.id || ''),
        startChat: candidate?.startChat || false,
        startChatCompleted: candidate?.startChatCompleted || false,
        engagementStatus: candidate?.engagementStatus || 'No Conversation',
        startMeetingSchedulingChat: candidate?.startMeetingSchedulingChat || false,
        startMeetingSchedulingChatCompleted: candidate?.startMeetingSchedulingChatCompleted || false,
        startVideoInterviewChat: candidate?.startVideoInterviewChat || false,
        startVideoInterviewChatCompleted: candidate?.startVideoInterviewChatCompleted || false,
        stopChat: candidate?.stopChat || false,
        createdAt: candidate?.createdAt || '',
        messagingChannel: candidate?.messagingChannel || '',
        lastMessage: candidate?.whatsappMessages?.edges?.length > 0 ? 
          [...(candidate?.whatsappMessages?.edges || [])]
            .sort((a, b) => new Date(b.node.createdAt).getTime() - new Date(a.node.createdAt).getTime())[0]
            ?.node?.message || '' : '',
        hasCv: candidate?.attachments?.edges?.length > 0 || false,
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
      console.log("Processed Data", processedData);
      return processedData;
    });
  };
