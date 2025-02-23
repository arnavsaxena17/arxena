import { Injectable } from '@nestjs/common';
import { axiosRequest } from '../utils/utils';
import { graphQltoUpdateOneCandidate, graphqlQueryToFindManyPeople } from '../graphql-queries';
import { UpdateChat } from '../../arx-chat/services/candidate-engagement/update-chat';
import * as allDataObjects from '../../arx-chat/services/data-model-objects';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { GoogleSheetsService } from '../../google-sheets/google-sheets.service';
import { FilterCandidates } from '../../arx-chat/services/candidate-engagement/filter-candidates';
import { CandidateService } from './candidate.service';

@Injectable()
export class ChatService {
  constructor(

    private readonly candidateService: CandidateService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly googleSheetsService: GoogleSheetsService

  ) {}


  async startChat(candidateId: string, apiToken: string): Promise<any> {
    const graphqlVariables = {
      idToUpdate: candidateId,
      input: {
        startChat: true,
      },
    };
    
    const graphqlQueryObj = JSON.stringify({
      query: graphQltoUpdateOneCandidate,
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
      query: graphQltoUpdateOneCandidate,
      variables: graphqlVariables,
    });

    const response = await axiosRequest(graphqlQueryObj, apiToken);
    console.log('Response from stopChat:', response.data);
    return response.data;
  }

  async fetchCandidateByPhoneNumberAndStartChat(phoneNumber: string, apiToken: string): Promise<any> {
    console.log('Fetching candidate by phone number:', phoneNumber);
    
    const personObj: allDataObjects.PersonNode = await new FilterCandidates(
      this.workspaceQueryService
    ).getPersonDetailsByPhoneNumber(phoneNumber, apiToken);

    const candidateId = personObj.candidates?.edges[0]?.node?.id;
    
    return this.startChat(candidateId, apiToken);
  }
}