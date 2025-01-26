import * as allDataObjects from '../data-model-objects';
import * as allGraphQLQueries from '../../graphql-queries/graphql-queries-chatbot';

export class Transformations {
  async updateChatHistoryObjCreateWhatsappMessageObj(
    wamId: string,
    personNode: allDataObjects.PersonNode,
    candidateJob: allDataObjects.Jobs,
    chatHistory: allDataObjects.ChatHistoryItem[],
    chatControl: allDataObjects.chatControls,
    
  ): Promise<allDataObjects.whatappUpdateMessageObjType | undefined> {
    const candidateNode = personNode?.candidates?.edges?.find(edge => edge.node.jobs.id == candidateJob.id)?.node;
    if (candidateNode) {
      const updatedChatHistoryObj: allDataObjects.whatappUpdateMessageObjType = {
        messageObj: chatHistory,
        candidateProfile: candidateNode,
        candidateFirstName: personNode.name?.firstName,
        phoneNumberFrom: allDataObjects.recruiterProfile?.phone,
        phoneNumberTo: personNode.phone,
        lastEngagementChatControl: chatControl.chatControlType,
        messages: chatHistory.slice(-1),
        messageType: 'botMessage',
        whatsappDeliveryStatus: 'created',
        whatsappMessageId: wamId,
        whatsappMessageType: ''
      };
      return updatedChatHistoryObj;
    }
    return undefined;
  }



  async updateMostRecentMessagesBasedOnNewSystemPrompt(
    mostRecentMessageArr: allDataObjects.ChatHistoryItem[],
    newSystemPrompt: string
  ): Promise<allDataObjects.ChatHistoryItem[]> {
    mostRecentMessageArr[0] = { role: 'system', content: newSystemPrompt };
    return mostRecentMessageArr;
  }

    getMostRecentMessageFromMessagesList(messagesList: allDataObjects.MessageNode[]) {
      let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = [];
      if (messagesList) {
        messagesList.sort((a, b) => new Date(b?.createdAt).getTime() - new Date(a?.createdAt).getTime());
        mostRecentMessageArr = messagesList[0]?.messageObj;
      }
      return mostRecentMessageArr;
    }
}
