import { Injectable } from '@nestjs/common';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { graphQltoUpdateOneCandidate, PersonNode } from 'twenty-shared';
import { FilterCandidates } from '../../arx-chat/services/candidate-engagement/filter-candidates';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
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

    const response = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, graphqlVariables, apiToken);

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

    const response = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, graphqlVariables, apiToken);
    console.log('Response from stopChat:', response.data);
    return response.data;
  }

  async fetchCandidateByPhoneNumberAndStartChat(phoneNumber: string, apiToken: string): Promise<any> {
    console.log('Fetching candidate by phone number:', phoneNumber);
    
    const personObj : PersonNode | undefined = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getPersonDetailsByPhoneNumber(phoneNumber, apiToken);

    if (!personObj) {
      throw new Error('Person not found');
    }

    const candidateId = personObj.candidates?.edges[0]?.node?.id;
    
    return this.startChat(candidateId, apiToken);
  }
}