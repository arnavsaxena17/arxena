import { parseStringPromise } from 'xml2js';
import * as fs from 'fs';
import { AttachmentProcessingService } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/attachment-processes';
import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { axiosRequest } from '../workspace-modifications/workspace-modifications.controller';
import { CleanPhoneNumbers } from 'src/engine/core-modules/candidate-sourcing/utils/clean-phone-numbers';
import {
    graphqlQueryToFindPhoneCalls,
    graphqlQueryToFindSMS,
    graphqlMutationToCreatePhoneCall,
    graphqlMutationToCreateSMS,
    graphqlMutationToUpdatePhoneCall,
    graphqlMutationToUpdateSMS
} from './graphql-queries';
import { FilterCandidates } from '../arx-chat/services/candidate-engagement/filter-candidates';


export class CallAndSMSProcessingService {

  constructor(
    private workspaceQueryService: any,
    private attachmentService: AttachmentProcessingService
  ) {}

  async processCallsAndSMS(callsXmlPath: string, smsXmlPath: string, recordingsPath: string, apiToken: string) {
    const callsData = await this.parseXMLFile(callsXmlPath);
    const smsData = await this.parseXMLFile(smsXmlPath);

    // Get current timestamp and threshold (30 minutes ago)
    const currentTime = Date.now();
    const thirtyMinutesAgo = currentTime - (30 * 60 * 1000);

    // Filter calls and SMS from last 30 minutes
    const recentCalls = callsData.calls.call.filter(call => 
      parseInt(call.$.date) >= thirtyMinutesAgo
    );
    console.log("Recent calls numbers are:", recentCalls.length)

    const recentSMS = smsData.smses.sms.filter(sms => 
      parseInt(sms.$.date) >= thirtyMinutesAgo
    );

    console.log("Recent SMS numbers are:", recentSMS.length)

    // Get unique phone numbers only from recent communications
    const phoneNumbers = new Set([
      ...recentCalls.map(call => call.$.number),
      ...recentSMS.map(sms => sms.$.address)
    ]);

    for (const phoneNumber of phoneNumbers) {
      await this.processPersonCommunications(
        phoneNumber, 
        { calls: { call: recentCalls } }, // Pass only recent calls
        { smses: { sms: recentSMS } },    // Pass only recent SMS
        recordingsPath, 
        apiToken
      );
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


    const cleanPhoneNumbersObj = new CleanPhoneNumbers();
    const cleanedPhoneNumber = cleanPhoneNumbersObj.cleanPhoneNumber(phoneNumber);
    const person = await new FilterCandidates(
      this.workspaceQueryService
    ).getPersonDetailsByPhoneNumber(cleanedPhoneNumber, apiToken);
  
    if (!person) return;
  
    const personCalls = callsData.calls.call.filter(call => call.$.number === phoneNumber);
    for (const call of personCalls) {
      const callData = call.$;
      try {
        // Find recording file by matching phone number in recordings folder
        const recordings = await fs.promises.readdir(recordingsFolder);
        const recordingFile = recordings.find(file => file.startsWith(phoneNumber));
        
        let attachmentId;
        if (recordingFile) {
          const recordingPath = `${recordingsFolder}/${recordingFile}`;
          console.log(`Uploading recording file: ${recordingPath}`);
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
          attachmentId = attachment.id;
        }
        
        await this.createOrUpdatePhoneCall({
          personId: person.id,
          phoneNumber,
          callType: this.mapCallType(callData.type),
          duration: parseInt(callData.duration),
          timestamp: new Date(parseInt(callData.date)),
          recordingAttachmentId: attachmentId,
          apiToken
        });
      } catch (error) {
        console.error(`Error processing call for phone number ${phoneNumber}:`, error);
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