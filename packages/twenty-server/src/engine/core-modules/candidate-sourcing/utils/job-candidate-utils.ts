import { CreateMetaDataStructure } from '../../workspace-modifications/object-apis/object-apis-creation';
import * as CandidateSourcingTypes from '../types/candidate-sourcing-types';

export class JobCandidateUtils {
    static getJobCandidatePathPosition(jobName: string, arxenaSiteId: string|undefined): string {
      return this.toCamelCase(jobName)
        .replace("-","")
        .replace(" ","")
        .replace("#","")
        .replace("/","")
        .replace("+","")
        .replace("(","")
        .replace(")","")
        .replace(",","")
        .replace(".","");
    }
  
    private static toCamelCase(str: string): string {
      return str
        .toLowerCase()
        .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));
    }
  



    static extractKeysFromObjects = (objects: CandidateSourcingTypes.ArxenaPersonNode[]): string[] => {
        console.log("number of onjects:", objects?.length);
        const keys = new Set<string>();
        objects.forEach(obj => {
          Object.keys(obj).forEach(key => keys.add(key));
        });
        console.log("keys:", keys);
        return Array.from(keys);
      };
    
    async generateJobCandidatesMutation(positionName: string): Promise<string> {
      const objectName = `${positionName}JobCandidate`;
      const pluralObjectName = `${positionName}JobCandidates`;
      const mutationName = `Create${objectName.charAt(0).toUpperCase() + objectName.slice(1)}s`;

      
      return `
        mutation ${mutationName}($data: [${objectName.charAt(0).toUpperCase() + objectName.slice(1)}CreateInput!]!) {
          create${pluralObjectName.charAt(0).toUpperCase() + pluralObjectName.slice(1)}(data: $data) {
            id
            person {
              id
            }
            job {
              id
            }
            candidate {
              id
            }
          }
        }
      `;

      
    }
    static generateFindManyJobCandidatesQuery(positionName: string): string {
      const objectName = `${positionName}JobCandidate`;
      const pluralObjectName = `${positionName}JobCandidates`;
      const queryName = `FindMany${pluralObjectName}`;
      
      return `
      query FindMany${pluralObjectName.charAt(0).toUpperCase() + pluralObjectName.slice(1)}($filter: ${objectName.charAt(0).toUpperCase() + objectName.slice(1)}FilterInput, $orderBy: [${objectName.charAt(0).toUpperCase() + objectName.slice(1)}OrderByInput], $lastCursor: String, $limit: Int) {
      ${pluralObjectName}(
          filter: $filter
          orderBy: $orderBy
          first: $limit
          after: $lastCursor
        ) {
          edges {

            node {
            id
            person {
              id
            }
            job {
              id
            }
            candidate {
              id
            }
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
    }
    `;
  }
    static isValidMongoDBId(str: string): boolean {
      if (!str || str.length !== 32) {
        return false;
      }
      const hexRegex = /^[0-9a-fA-F]{32}$/;
      return hexRegex.test(str);
    }
  
    static isValidUUIDv4(str: string): boolean {
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidV4Regex.test(str);
    }
  
    static createJobCandidateObject(name: string, pathPosition: string) {
      return {
        object: {
          description: `New Job Candidate Object for ${name}`,
          icon: "IconUsers",
          labelPlural: `${pathPosition}JobCandidates`,
          labelSingular: `${pathPosition}JobCandidate`,
          nameSingular: `${pathPosition}JobCandidate`,
          namePlural: `${pathPosition}JobCandidates`
        }
      };
    }
  }