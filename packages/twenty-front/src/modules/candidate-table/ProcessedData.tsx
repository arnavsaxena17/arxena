import type { CandidateNode } from 'twenty-shared/arx';
import { flattenCandidateFlags } from 'twenty-shared/arx';
import { getResolvedOtherFields, otherFieldsToFlatRow } from 'twenty-shared/utils';
import { isLinkedInUrl, reconstructLinkedInUrlForDisplay } from "../../utils/linkedinUrlUtils";
import { type ProcessedDataItem } from "./TableColumns";

export const ProcessedData = ({ rawData, selectedRowIds }: { rawData: CandidateNode[], selectedRowIds: string[] }): ProcessedDataItem[] => {
    if (!rawData || !rawData.length) return [];
    return rawData.map((candidate) => {
      const flattenedCandidate = flattenCandidateFlags(candidate);
      const baseData: ProcessedDataItem = {
        id: flattenedCandidate?.id || '',
        personId: flattenedCandidate?.peopleId || '',
        name: flattenedCandidate?.name || '',
        phone: flattenedCandidate?.phoneNumber?.primaryPhoneNumber || '',
        email: flattenedCandidate?.email?.primaryEmail || '',
        remarks: flattenedCandidate?.remarks || '',
        status: flattenedCandidate?.status || 'No Status',
        candConversationStatus: flattenedCandidate?.candConversationStatus || 'No Conversation',
        checkbox: selectedRowIds.includes(flattenedCandidate?.id || ''),
        startChat: flattenedCandidate?.startChat || false,
        startChatCompleted: flattenedCandidate?.startChatCompleted || false,
        jobTitle: flattenedCandidate?.jobTitle || '',
        jobCompanyName: flattenedCandidate?.jobCompanyName || '',
        updatedAt: flattenedCandidate?.updatedAt ? String(flattenedCandidate.updatedAt) : '',
        stopChat: flattenedCandidate?.stopChat || false,
        source: flattenedCandidate?.source || 'N/A',
        messagingChannel: flattenedCandidate?.messagingChannel || '',
        resdexNaukriUrl: flattenedCandidate?.resdexNaukriUrl?.primaryLinkUrl?.includes('resdex.naukri.com') ? flattenedCandidate?.resdexNaukriUrl?.primaryLinkUrl : '',
        hiringNaukriUrl: flattenedCandidate?.hiringNaukriUrl?.primaryLinkUrl?.includes('hiring.naukri.com') ? flattenedCandidate?.hiringNaukriUrl?.primaryLinkUrl : '',
        linkedinUrl: flattenedCandidate?.linkedinUrl?.primaryLinkUrl && isLinkedInUrl(flattenedCandidate.linkedinUrl.primaryLinkUrl) ? 
          reconstructLinkedInUrlForDisplay(flattenedCandidate.linkedinUrl.primaryLinkUrl) : '',
        lastMessage: (() => {
          const edges = [...(flattenedCandidate?.chatMessages?.edges || [])].sort(
            (a, b) =>
              new Date(b.node?.createdAt || 0).getTime() -
              new Date(a.node?.createdAt || 0).getTime(),
          );
          const inbound = edges.find((edge) => {
            const node = edge?.node as {
              message?: string;
              isFromMe?: boolean;
              messageType?: string;
            };
            if (!node?.message) {
              return false;
            }
            if (node.isFromMe === true || node.messageType === 'messageFromSelf') {
              return false;
            }
            return true;
          });
          const latest = inbound ?? edges[0];
          return (
            (latest?.node as { message?: string } | undefined)?.message || ''
          );
        })(),
        hasCv: flattenedCandidate?.attachments?.edges?.length > 0 || false,
        cvAvailability: flattenedCandidate?.attachments?.edges?.length > 0 ? 'CV Available' : 'CV Not found',
      };

      const otherFieldValues = otherFieldsToFlatRow(getResolvedOtherFields(flattenedCandidate));

      const processedData: ProcessedDataItem = {
        ...baseData,
        ...otherFieldValues,
      };
      return processedData;
    });
  };
