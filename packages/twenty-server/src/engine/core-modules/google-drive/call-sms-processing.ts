import { parseStringPromise } from 'xml2js';
import * as fs from 'fs';
import { AttachmentProcessingService } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/attachment-processing';
import { FetchAndUpdateCandidatesChatsWhatsapps } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { axiosRequest } from '../workspace-modifications/workspace-modifications.controller';
// types.ts
export interface PhoneCall {
    id: string;
    personId: string;
    phoneNumber: string; 
    callType: 'INCOMING' | 'OUTGOING' | 'MISSED' | 'REJECTED';
    duration: number;
    timestamp: Date;
    recordingAttachmentId?: string;
   }
   
   export interface SMS {
    id: string;
    personId: string;
    phoneNumber: string;
    messageType: 'INCOMING' | 'OUTGOING';
    message: string;
    timestamp: Date;
   }
   
   // graphql-queries.ts
   export const graphqlQueryToFindPhoneCalls = `
   query FindManyPhoneCalls($filter: PhoneCallFilterInput, $orderBy: [PhoneCallOrderByInput], $lastCursor: String, $limit: Int) {
    phoneCalls(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
      edges {
        node {
          id
          personId
          phoneNumber
          callType
          duration
          timestamp
          recordingAttachmentId
        }
        cursor
      }
      pageInfo {
        hasNextPage
        startCursor 
        endCursor
      }
      totalCount
    }
   }`;
   
   export const graphqlQueryToFindSMS = `
   query FindManySMS($filter: SMSFilterInput, $orderBy: [SMSOrderByInput], $lastCursor: String, $limit: Int) {
    smsMessages(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
      edges {
        node {
          id
          personId
          phoneNumber
          messageType
          message
          timestamp
        }
        cursor
      }
      pageInfo {
        hasNextPage
        startCursor
        endCursor
      }
      totalCount
    }
   }`;
   
   export const graphqlMutationToCreatePhoneCall = `
   mutation CreatePhoneCall($input: CreatePhoneCallInput!) {
    createPhoneCall(data: $input) {
      id
      personId
      phoneNumber
      callType
      duration
      timestamp
      recordingAttachmentId
    }
   }`;
   
   export const graphqlMutationToCreateSMS = `
   mutation CreateSMS($input: CreateSMSInput!) {
    createSMS(data: $input) {
      id
      personId 
      phoneNumber
      messageType
      message
      timestamp
    }
   }`;
   
   export const graphqlMutationToUpdatePhoneCall = `
   mutation UpdatePhoneCall($id: ID!, $input: UpdatePhoneCallInput!) {
    updatePhoneCall(id: $id, data: $input) {
      id
      personId
      phoneNumber
      callType
      duration
      timestamp
      recordingAttachmentId
    }
   }`;
   
   export const graphqlMutationToUpdateSMS = `
   mutation UpdateSMS($id: ID!, $input: UpdateSMSInput!) {
    updateSMS(id: $id, data: $input) {
      id
      personId
      phoneNumber
      messageType
      message
      timestamp
    }
   }`;
export class CallAndSMSProcessingService {

  constructor(
    private workspaceQueryService: any,
    private attachmentService: AttachmentProcessingService
  ) {}

  async processCallsAndSMS(callsXmlPath: string, smsXmlPath: string, recordingsPath: string, apiToken: string) {
    const callsData = await this.parseXMLFile(callsXmlPath);
    const smsData = await this.parseXMLFile(smsXmlPath);

    const phoneNumbers = new Set([
      ...callsData.calls.call.map(call => call.$.number),
      ...smsData.smses.sms.map(sms => sms.$.address)
    ]);

    for (const phoneNumber of phoneNumbers) {
      await this.processPersonCommunications(phoneNumber, callsData, smsData, recordingsPath, apiToken);
    }
  }

  private async parseXMLFile(filePath: string) {
    const xmlContent = await fs.promises.readFile(filePath, 'utf-8');
    return parseStringPromise(xmlContent);
  }

  async processPersonCommunications(
    phoneNumber: string, 
    callsData: any, 
    smsData: any,
    recordingsFolder: string,
    apiToken: string
  ) {
    const person = await new FetchAndUpdateCandidatesChatsWhatsapps(
      this.workspaceQueryService
    ).getPersonDetailsByPhoneNumber(phoneNumber, apiToken);
  
    if (!person) return;
  
    const personCalls = callsData.calls.call.filter(call => call.$.number === phoneNumber);
    for (const call of personCalls) {
      const callData = call.$;
      // Find recording file by matching phone number in recordings folder
      const recordings = await fs.promises.readdir(recordingsFolder);
      const recordingFile = recordings.find(file => file.startsWith(phoneNumber));
      
      let attachmentId;
      if (recordingFile) {
        const recordingPath = `${recordingsFolder}/${recordingFile}`;
        console.log(`Uploading recording file: ${recordingPath}`);
        console.log(`this.attachmentService: ${this.attachmentService}`);
        const uploadResponse = await this.attachmentService.uploadAttachmentToTwenty(recordingPath, apiToken);
        
        const dataToUploadInAttachmentTable = {
          input: {
            authorId: "SYSTEM",
            name: recordingFile,
            fullPath: uploadResponse.data.uploadFile,
            type: "CALL_RECORDING", 
            personId: person.id
          }
        };
   
        const attachment = await this.attachmentService.createOneAttachmentFromFilePath(
          dataToUploadInAttachmentTable,
          apiToken
        );
   
         await this.createOrUpdatePhoneCall({
        personId: person.id,
        phoneNumber,
        callType: this.mapCallType(callData.type),
        duration: parseInt(callData.duration),
        timestamp: new Date(parseInt(callData.date)),
        recordingAttachmentId: attachmentId,
        apiToken
      });
    }
    }

    // Process SMS
    const personSMS = smsData.smses.sms.filter(sms => sms.$.address === phoneNumber);
    for (const sms of personSMS) {
      const smsData = sms.$;
      await this.createOrUpdateSMS({
        personId: person.id,
        phoneNumber,
        messageType: this.mapSMSType(smsData.type),
        message: smsData.body,
        timestamp: new Date(parseInt(smsData.date)),
        apiToken
      });
    }
  }

  private mapCallType(type: string): string {
    const types = {
      '1': 'INCOMING',
      '2': 'OUTGOING',
      '3': 'MISSED',
      '5': 'REJECTED'
    };
    return types[type] || 'UNKNOWN';
  }

  private mapSMSType(type: string): string {
    return type === '1' ? 'INCOMING' : 'OUTGOING';
  }

  private formatDateTime(timestamp: string): string {
    const date = new Date(parseInt(timestamp));
    return date.toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  }

  // Add GraphQL mutation implementations for PhoneCall and SMS objects
  async createOrUpdatePhoneCall({personId, phoneNumber, callType, duration, timestamp, recordingAttachmentId, apiToken}) {
    const query = JSON.stringify({
      query: graphqlQueryToFindPhoneCalls,
      variables: {
        filter: { 
          personId: { eq: personId },
          timestamp: { eq: timestamp }
        }
      }
    });
  
    const existingCalls = await axiosRequest(query, apiToken);
    
    if (existingCalls?.data?.data?.phoneCalls?.edges?.length) {
      const call = existingCalls.data.data.phoneCalls.edges[0].node;
      const updateQuery = JSON.stringify({
        query: graphqlMutationToUpdatePhoneCall,
        variables: {
          id: call.id,
          input: { callType, duration, recordingAttachmentId }
        }
      });
      return axiosRequest(updateQuery, apiToken);
    }
  
    const createQuery = JSON.stringify({
      query: graphqlMutationToCreatePhoneCall,
      variables: {
        input: {
          personId,
          phoneNumber,
          callType,
          duration,
          timestamp,
          recordingAttachmentId
        }
      }
    });
    return axiosRequest(createQuery, apiToken);
  }
  
  

  async createOrUpdateSMS({personId, phoneNumber, messageType, message, timestamp, apiToken}) {
    const query = JSON.stringify({
      query: graphqlQueryToFindSMS,
      variables: {
        filter: {
          personId: { eq: personId },
          timestamp: { eq: timestamp }
        }
      }
    });
  
    const existingSMS = await axiosRequest(query, apiToken);
  
    if (existingSMS?.data?.data?.smsMessages?.edges?.length) {
      const sms = existingSMS.data.data.smsMessages.edges[0].node;
      const updateQuery = JSON.stringify({
        query: graphqlMutationToUpdateSMS,
        variables: {
          id: sms.id,
          input: { messageType, message }
        }
      });
      return axiosRequest(updateQuery, apiToken);
    }
  
    const createQuery = JSON.stringify({
      query: graphqlMutationToCreateSMS,
      variables: {
        input: {
          personId,
          phoneNumber,
          messageType,
          message,
          timestamp
        }
      }
    });
    return axiosRequest(createQuery, apiToken);
  }
}