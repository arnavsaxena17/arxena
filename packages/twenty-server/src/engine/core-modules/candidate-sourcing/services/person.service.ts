import { Injectable } from '@nestjs/common';

import axios from 'axios';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { ArxenaPersonNode, CreateManyPeople, graphqlQueryToFindManyPeople, PersonNode } from 'twenty-shared';

@Injectable()
export class PersonService {
  constructor(private readonly staticGraphQLService: StaticGraphQLService) {}
    async createPeople(manyPersonObjects: ArxenaPersonNode[], apiToken: string): Promise<any> {
    console.log('Creating people, manyPersonObjects:', manyPersonObjects.length);

    const graphqlVariables = { data: manyPersonObjects };
    const graphqlQueryObj = JSON.stringify({
      query: CreateManyPeople,
      variables: graphqlVariables,
    });

    try {
      const response = await this.staticGraphQLService.executeGraphQL(CreateManyPeople, graphqlVariables, apiToken);
      return response;
    } catch (error) {
      console.error('Error in creating people', error);
      throw error;
    }
  }

  async purchaseAndUpdateApnaProfile(field: string, value: string, candidateId: string, personId: string, uniqueStringKey:string, apiToken: string, spreadsheetId:string): Promise<any> {
    const url = process.env.ENV_NODE === 'production' ? 'https://arxena.com/fetch_and_update_apna_profile' : 'http://localhost:5050/fetch_and_update_apna_profile';
    console.log("REceived:::", field, value, candidateId, personId, uniqueStringKey, apiToken);
    try {
      const response = await axios.post( url,
      { field, value, candidateId, personId, uniqueStringKey, apiToken, spreadsheetId },
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
    try {
      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlQueryToFindManyPeople,
        graphqlVariables,
        apiToken,
      );
      const people = response.data?.data?.people?.edges || [];
      const personMap = new Map<string, PersonNode>(
        people.map((edge: any) => [edge.node.uniqueStringKey, edge.node]),
      );
      return personMap as Map<string, PersonNode>;
    } catch (error) {
      console.error('Error in batchGetPersonDetailsByStringKeys:', error);
      throw error;
    }
  }

  async batchGetPersonDetailsByEmails(
    emails: string[],
    apiToken: string,
  ): Promise<Map<string, PersonNode>> {
    const cleanedEmails = emails
      .filter(Boolean)
      .map((email) => email.toLowerCase().trim())
      .filter((email, index, array) => array.indexOf(email) === index);

    if (cleanedEmails.length === 0) {
      return new Map<string, PersonNode>();
    }

    const graphqlVariables = {
      filter: {
        emails: {
          primaryEmail: {
            in: cleanedEmails,
          },
        },
      },
      limit: 30,
    };

    try {
      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlQueryToFindManyPeople,
        graphqlVariables,
        apiToken,
      );
      const people = response.data?.data?.people?.edges || [];

      const personMap = new Map<string, PersonNode>();

      for (const edge of people) {
        const node = edge.node as PersonNode;
        const primaryEmail = (node as any)?.emails?.primaryEmail
          ? (node as any).emails.primaryEmail.toLowerCase().trim()
          : null;

        if (primaryEmail) {
          personMap.set(primaryEmail, node);
        }
      }

      return personMap;
    } catch (error) {
      console.error('Error in batchGetPersonDetailsByEmails:', error);
      throw error;
    }
  }
}
