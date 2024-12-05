import { createObjectMetadataItems } from './services/object-service';
import { createRelations } from './services/relation-service';
import { createFields } from './services/field-service';
import { QueryResponse, ObjectMetadata } from './types/types.js';
import axios from 'axios';
import { WorkspaceQueryService } from '../workspace-modifications.service.js';
import { executeQuery } from './utils/graphqlClient.js';
import { objectCreationArr } from './data/objectsData';
import { getFieldsData } from './data/fieldsData';
import { getRelationsData } from './data/relationsData';


export class CreateMetaDataStructure{
    constructor(
        private readonly workspaceQueryService: WorkspaceQueryService
      ) {}
    async axiosRequest(data: string, apiToken: string) {
        // console.log("Sending a post request to the graphql server:: with data", data);
        const response = await axios.request({
          method: "post",
          url: process.env.GRAPHQL_URL,
          headers: {
            authorization: "Bearer " + apiToken,
            "content-type": "application/json",
          },
          data: data,
        });
        return response;
      }
    



    // fetchAllCurrentObjects = async (apiToken: string) => {
    //     const objectsResponse = await executeQuery<QueryResponse<ObjectMetadata>>(`
    //         query ObjectMetadataItems($objectFilter: objectFilter) {
    //         objects(paging: {first: 1000}, filter: $objectFilter) {
    //             edges {
    //             node {
    //                 id
    //                 nameSingular
    //                 namePlural
    //                 labelSingular
    //                 labelPlural
    //                 __typename
    //             }
    //             __typename
    //             }
    //         }
    //         }            
    //     `, { objectFilter: { isActive: { is: true } } }, apiToken);
    //     return objectsResponse;

    // }
    fetchAllCurrentObjects = async (apiToken: string) => {
        const objectsResponse = await executeQuery<QueryResponse<ObjectMetadata>>(`
        query ObjectMetadataItems($objectFilter: objectFilter, $fieldFilter: fieldFilter) {
          objects(paging: {first: 1000}, filter: $objectFilter) {
            edges {
              node {
                id
                nameSingular
                namePlural
                labelSingular
                labelPlural
                fields(paging: {first: 1000}, filter: $fieldFilter) {
                  edges {
                    node {
                      name
                    }
                  }
                }
              }
            }
          }
        }`, { objectFilter: { isActive: { is: true } } }, apiToken);
        return objectsResponse;
    }

    async fetchObjectsNameIdMap(apiToken: string): Promise<Record<string, string>> {
        const objectsResponse = await this.fetchAllCurrentObjects(apiToken);
        console.log("objectsResponse:", objectsResponse);
        const objectsNameIdMap: Record<string, string> = {};
        objectsResponse?.data?.objects?.edges?.forEach(edge => {
            if (edge?.node?.nameSingular && edge?.node?.id) {
                objectsNameIdMap[edge.node.nameSingular] = edge.node.id;
            }
        });
        console.log("objectsNameIdMap", objectsNameIdMap);
        return objectsNameIdMap;
    }
    
    async createMetadataStructure(apiToken:string): Promise<void> {
    
        try {
            console.log('Starting metadata structure creation...');
            
            await createObjectMetadataItems(apiToken, objectCreationArr);
            console.log('Object metadata items created successfully');
            
            const objectsNameIdMap = await this.fetchObjectsNameIdMap(apiToken);

            const fieldsData = getFieldsData(objectsNameIdMap);

            await createFields(fieldsData, apiToken);
            console.log('Fields created successfully');
            const relationsFields = getRelationsData(objectsNameIdMap);

            await createRelations(relationsFields, apiToken);
            console.log('Relations created successfully');

            
            console.log('Metadata structure creation completed');
        } catch (error) {
            console.log('Error creating metadata structure:', error);
        }
    }
    
}
