import * as allDataObjects from '../data-model-objects';
import * as allGraphQLQueries from '../../graphql-queries/graphql-queries-chatbot';

export class Tranformations {
  async updateChatHistoryObjCreateWhatsappMessageObj(
    wamId: string,
    personNode: allDataObjects.PersonNode,
    chatHistory: allDataObjects.ChatHistoryItem[],
    chatControl: allDataObjects.chatControls,
    apiToken: string,
  ): Promise<allDataObjects.candidateChatMessageType> {
    const candidateNode = personNode.candidates.edges[0].node;
    const updatedChatHistoryObj: allDataObjects.candidateChatMessageType = {
      messageObj: chatHistory,
      candidateProfile: candidateNode,
      whatsappMessageType: candidateNode?.whatsappProvider || 'application03',
      candidateFirstName: personNode.name?.firstName,
      phoneNumberFrom: allDataObjects.recruiterProfile?.phone,
      phoneNumberTo: personNode.phone,
      lastEngagementChatControl: chatControl.chatControlType,
      messages: chatHistory.slice(-1),
      messageType: 'botMessage',
      whatsappDeliveryStatus: 'created',
      whatsappMessageId: wamId,
    };
    return updatedChatHistoryObj;
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
