import { Injectable } from '@nestjs/common';

import { graphQltoUpdateOneCandidate, PersonNode } from 'twenty-shared';

import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { axiosRequest } from 'src/engine/core-modules/candidate-sourcing/utils/utils';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

@Injectable()
export class ChatService {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

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

  async fetchCandidateByPhoneNumberAndStartChat(
    phoneNumber: string,
    apiToken: string,
  ): Promise<any> {
    console.log('Fetching candidate by phone number:', phoneNumber);

    const personObj: PersonNode = await new FilterCandidates(
      this.workspaceQueryService,
    ).getPersonDetailsByPhoneNumber(phoneNumber, apiToken);

    const candidateId = personObj.candidates?.edges[0]?.node?.id;

    return this.startChat(candidateId, apiToken);
  }
}
