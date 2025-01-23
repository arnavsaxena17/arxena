import { Injectable } from '@nestjs/common';
import { axiosRequest } from '../utils/utils';
import { CreateManyPeople } from '../graphql-queries';
import * as allDataObjects from '../../arx-chat/services/data-model-objects';

import * as CandidateSourcingTypes from '../types/candidate-sourcing-types';
import * as allGraphQLQueries from '../graphql-queries';

@Injectable()
export class PersonService {
  async createPeople(manyPersonObjects: CandidateSourcingTypes.ArxenaPersonNode[], apiToken: string): Promise<any> {
    console.log('Creating people, manyPersonObjects:', manyPersonObjects.length);
    
    const graphqlVariables = { data: manyPersonObjects };
    const graphqlQueryObj = JSON.stringify({
      query: CreateManyPeople,
      variables: graphqlVariables,
    });

    try {
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      return response;
    } catch (error) {
      console.error('Error in creating people', error);
      throw error;
    }
  }

  async batchGetPersonDetailsByStringKeys(uniqueStringKeys: string[], apiToken: string): Promise<Map<string, allDataObjects.PersonNode>> {
    const graphqlVariables = {
      filter: { uniqueStringKey: { in: uniqueStringKeys } },
      limit: 30,
    };

    const graphqlQuery = JSON.stringify({
      query: allGraphQLQueries.graphqlQueryToFindManyPeople,
      variables: graphqlVariables,
    });

    try {
      const response = await axiosRequest(graphqlQuery, apiToken);
      const people = response.data?.data?.people?.edges || [];
      const personMap = new Map<string, allDataObjects.PersonNode>(
        people.map((edge: any) => [edge.node.uniqueStringKey, edge.node])
      );
      return personMap as Map<string, allDataObjects.PersonNode>;
    } catch (error) {
      console.error('Error in batchGetPersonDetails:', error);
      throw error;
    }
  }
}