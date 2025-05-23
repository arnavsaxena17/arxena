import { Injectable } from '@nestjs/common';
import { axiosRequest } from '../utils/utils';

import axios from 'axios';
import { ArxenaPersonNode, CreateManyPeople, graphqlQueryToFindManyPeople, PersonNode } from 'twenty-shared';

@Injectable()
export class PersonService {
  async createPeople(manyPersonObjects: ArxenaPersonNode[], apiToken: string): Promise<any> {
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

  async purchaseAndUpdateApnaProfile(field: string, value: string, candidateId: string, personId: string, unique_key_string:string, apiToken: string, spreadsheetId:string): Promise<any> {
    const url = process.env.ENV_NODE === 'production' ? 'https://arxena.com/fetch_and_update_apna_profile' : 'http://localhost:5050/fetch_and_update_apna_profile';
    console.log("REceived:::", field, value, candidateId, personId, unique_key_string, apiToken);
    try {
      const response = await axios.post( url,
      { field, value, candidateId, personId, unique_key_string, apiToken, spreadsheetId },
      { headers: {'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}`}});
      return response.data;
    } catch (error) {
      console.log('Error in purchaseAndUpdateApnaProfile:', error);
    }
  }

  async batchGetPersonDetailsByStringKeys(uniqueStringKeys: string[], apiToken: string): Promise<Map<string, PersonNode>> {
    const graphqlVariables = {
      filter: { uniqueStringKey: { in: uniqueStringKeys } },
      limit: 30,
    };

    const graphqlQuery = JSON.stringify({
      query: graphqlQueryToFindManyPeople,
      variables: graphqlVariables,
    });

    try {
      const response = await axiosRequest(graphqlQuery, apiToken);
      const people = response.data?.data?.people?.edges || [];
      const personMap = new Map<string, PersonNode>(people.map((edge: any) => [edge.node.uniqueStringKey, edge.node]));
      return personMap as Map<string, PersonNode>;
    } catch (error) {
      console.error('Error in batchGetPersonDetails:', error);
      throw error;
    }
  }
}
