import { Injectable } from '@nestjs/common';
import { axiosRequest } from '../utils/utils';
import { graphQltoStartChat, graphQltoStopChat, graphqlQueryToFindPeopleByPhoneNumber } from '../graphql-queries';
import { FetchAndUpdateCandidatesChatsWhatsapps } from '../../arx-chat/services/candidate-engagement/update-chat';
import * as allDataObjects from '../../arx-chat/services/data-model-objects';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { GoogleSheetsService } from '../../google-sheets/google-sheets.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly googleSheetsService: GoogleSheetsService

  ) {}

  async processCandidateChats(apiToken: string): Promise<object> {
    try {
        // TBD
      console.log("Processing candidate chats");
      const results = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).processCandidatesChatsGetStatuses(apiToken);
      return { status: 'Success' };
    } catch (err) {
      console.error('Error in process:', err);
      return { status: 'Failed', error: err };
    }
  }
  async refreshChats(
    candidateIds: string[], 
    currentWorkspaceMemberId: string, 
    apiToken: string
  ): Promise<object> {
    try {
      console.log("Refreshing chats");
      
      // Process candidate chats and get statuses
      const results = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).processCandidatesChatsGetStatuses(apiToken, candidateIds, currentWorkspaceMemberId);
      
      // Update Google Sheets with the processed results
      await this.googleSheetsService.updateGoogleSheetsWithChatData(results, apiToken);
      
      return { status: 'Success' };
    } catch (err) {
      console.error('Error in refresh chats:', err);
      return { status: 'Failed', error: err };
    }
  }

  async startChat(candidateId: string, apiToken: string): Promise<any> {
    const graphqlVariables = {
      idToUpdate: candidateId,
      input: {
        startChat: true,
      },
    };
    
    const graphqlQueryObj = JSON.stringify({
      query: graphQltoStartChat,
      variables: graphqlVariables,
    });

    const response = await axiosRequest(graphqlQueryObj, apiToken);
    console.log('Response from startChat:', response.data);
    return response.data;
  }

  async stopChat(candidateId: string, apiToken: string): Promise<any> {
    const graphqlVariables = {
      idToUpdate: candidateId,
      input: {
        stopChat: true,
      },
    };
    
    const graphqlQueryObj = JSON.stringify({
      query: graphQltoStopChat,
      variables: graphqlVariables,
    });

    const response = await axiosRequest(graphqlQueryObj, apiToken);
    console.log('Response from stopChat:', response.data);
    return response.data;
  }

  async fetchCandidateByPhoneNumberAndStartChat(phoneNumber: string, apiToken: string): Promise<any> {
    console.log('Fetching candidate by phone number:', phoneNumber);
    
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps(
      this.workspaceQueryService
    ).getPersonDetailsByPhoneNumber(phoneNumber, apiToken);

    const candidateId = personObj.candidates?.edges[0]?.node?.id;
    
    return this.startChat(candidateId, apiToken);
  }
}