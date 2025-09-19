import { CandidateNode } from "twenty-shared";
import { isLinkedInUrl, reconstructLinkedInUrlForDisplay } from "../../utils/linkedinUrlUtils";

export const ProcessedData = ({ rawData, selectedRowIds }: { rawData: CandidateNode[], selectedRowIds: string[] }) => {
    if (!rawData || !rawData.length) return [];
    return rawData.map(candidate => {
      const baseData = {
        id: candidate?.id,
        personId: candidate?.peopleId,
        name: candidate?.name || '',
        // firstName: candidate?.name || '',
        // lastName: candidate?.name || '',
        phone: candidate?.phoneNumber?.primaryPhoneNumber || '',
        email: candidate?.email?.primaryEmail || '',
        remarks: candidate?.remarks || '',
        status: candidate?.status || 'No Status',
        candConversationStatus: candidate?.candConversationStatus || 'No Conversation',
        checkbox: selectedRowIds.includes(candidate?.id || ''),
        startChat: candidate?.startChat || false,
        startChatCompleted: candidate?.startChatCompleted || false,
        jobTitle: candidate?.jobTitle || '',
        updatedAt: candidate?.updatedAt || '',
        // engagementStatus: candidate?.engagementStatus || false,
        // startMeetingSchedulingChat: candidate?.startMeetingSchedulingChat || false,
        // startMeetingSchedulingChatCompleted: candidate?.startMeetingSchedulingChatCompleted || false,
        // startVideoInterviewChat: candidate?.startVideoInterviewChat || false,
        // startVideoInterviewChatCompleted: candidate?.startVideoInterviewChatCompleted || false,
        
        stopChat: candidate?.stopChat || false,
        source: candidate?.source || 'N/A',
        messagingChannel: candidate?.messagingChannel || '',
        resdexNaukriUrl: candidate?.resdexNaukriUrl?.primaryLinkUrl?.includes('resdex.naukri.com') ? candidate?.resdexNaukriUrl?.primaryLinkUrl : '',
        hiringNaukriUrl: candidate?.hiringNaukriUrl?.primaryLinkUrl?.includes('hiring.naukri.com') ? candidate?.hiringNaukriUrl?.primaryLinkUrl : '',
        linkedinUrl: candidate?.linkedinUrl?.primaryLinkUrl && isLinkedInUrl(candidate.linkedinUrl.primaryLinkUrl) ? 
          reconstructLinkedInUrlForDisplay(candidate.linkedinUrl.primaryLinkUrl) : '',
        lastMessage: candidate?.whatsappMessages?.edges?.length > 0 ? 
          [...(candidate?.whatsappMessages?.edges || [])]
            .sort((a, b) => new Date(b.node?.createdAt || 0).getTime() - new Date(a.node?.createdAt || 0).getTime())[0]
            ?.node?.createdAt || '' : '',
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
      const processedData = {  ...fieldValues, ...baseData };
      // console.log("processedData re these:", processedData);
      return processedData;
    });
  };
