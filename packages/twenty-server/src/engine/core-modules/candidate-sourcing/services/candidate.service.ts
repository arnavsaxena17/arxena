import { Injectable } from '@nestjs/common';
import { JobService } from './job.service';
import { PersonService } from './person.service';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { axiosRequest, axiosRequestForMetadata } from '../utils/utils';
import { CreateManyCandidates } from '../graphql-queries';
import { processArxCandidate } from '../utils/data-transformation-utility';
import * as CandidateSourcingTypes from '../types/candidate-sourcing-types';
import { JobCandidateUtils } from '../utils/job-candidate-utils';
import { CreateMetaDataStructure } from '../../workspace-modifications/object-apis/object-apis-creation';
import { createFields } from '../../workspace-modifications/object-apis/services/field-service';
import { createRelations } from '../../workspace-modifications/object-apis/services/relation-service';
import * as allGraphQLQueries from '../../arx-chat/services/candidate-engagement/graphql-queries-chatbot';
import { CreateFieldsOnObject } from 'src/engine/core-modules/workspace-modifications/object-apis/data/createFields';
import * as allDataObjects from '../../arx-chat/services/data-model-objects';



export const newFieldsToCreate = [
  "name",
  "jobTitle",
  // "currentOrganization",
  "age",
  // "currentLocation",
  // "inferredSalary",
  "email",
  "profileUrl",
  "phone",
  "uniqueStringKey",
  "profileTitle",
  "displayPicture",
  // "preferredLocations",
  "birthDate",
  // "inferredYearsExperience",
  // "noticePeriod",
  // "homeTown",
  // "maritalStatus",
  // "ugInstituteName",
  // "ugGraduationYear",
  // "pgGradudationDegree",
  // "ugGraduationDegree",
  // "pgGraduationYear",
  "resumeHeadline",
  "keySkills",
  // "industry",
  // "modifyDateLabel",
  // "experienceYears",
  // "experienceMonths",
]
interface ProcessingContext {
  jobCandidateInfo: {
    jobCandidateObjectId: string;
    jobCandidateObjectName: string;
    path_position: string;
  };
  timestamp: string;
}



@Injectable()
export class CandidateService {

  constructor(
    private readonly jobService: JobService,
    private readonly personService: PersonService,
    private readonly workspaceQueryService: WorkspaceQueryService,

) {}

private processingContexts = new Map<string, ProcessingContext>();

private async checkExistingRelations(objectMetadataId: string, apiToken: string): Promise<any[]> {
  try {
    const query = `
      query GetExistingRelations($objectMetadataId: ID!) {
        relations(filter: { 
          or: [
            { fromObjectMetadataId: { eq: $objectMetadataId } },
            { toObjectMetadataId: { eq: $objectMetadataId } }
          ]
        }) {
          edges {
            node {
              fromObjectMetadataId
              toObjectMetadataId
            }
          }
        }
      }
    `;

    const response = await axiosRequest(JSON.stringify({
      query,
      variables: { objectMetadataId }
    }), apiToken);

    return response.data?.data?.relations?.edges?.map((edge: any) => edge.node) || [];
  } catch (error) {
    console.error('Error checking existing relations:', error);
    return [];
  }
}

async createRelationsBasedonObjectMap(jobCandidateObjectId: string, jobCandidateObjectName: string, apiToken: string): Promise<void> {
  const objectsNameIdMap = await new CreateMetaDataStructure(this.workspaceQueryService).fetchObjectsNameIdMap(apiToken);
  const existingRelations = await this.checkExistingRelations(jobCandidateObjectId, apiToken);
  const relationsToCreate = [
    {
      relation: {
        fromObjectMetadataId: objectsNameIdMap['person'],
        toObjectMetadataId: jobCandidateObjectId,
        relationType: "ONE_TO_MANY" as const,
        fromName: jobCandidateObjectName,
        toName: "person",
        fromDescription: "Job Candidate",
        toDescription: "Person",
        fromLabel: "Job Candidate",
        toLabel: "Person",
        fromIcon: "IconUserCheck",
        toIcon: "IconUser"
      }
    },
    {
      relation: {
        fromObjectMetadataId: objectsNameIdMap['candidate'],
        toObjectMetadataId: jobCandidateObjectId,
        relationType: "ONE_TO_MANY" as const,
        fromName: jobCandidateObjectName,
        toName: "candidate",
        fromDescription: "Job Candidate",
        toDescription: "Candidate",
        fromLabel: "Job Candidate",
        toLabel: "Candidate",
        fromIcon: "IconUserCheck",
        toIcon: "IconUser"
      }
    },
    {
      relation: {
        fromObjectMetadataId: objectsNameIdMap['job'],
        toObjectMetadataId: jobCandidateObjectId,
        relationType: "ONE_TO_MANY" as const,
        fromName: jobCandidateObjectName,
        toName: "job",
        fromDescription: "Job Candidate",
        toDescription: "Job",
        fromLabel: "Job Candidate",
        toLabel: "Job",
        fromIcon: "IconUserCheck",
        toIcon: "IconUser"
      }
    }
  ].filter(relation => {
    // Filter out relations that already exist
    return !existingRelations.some(existing => 
      existing.fromObjectMetadataId === relation.relation.fromObjectMetadataId &&
      existing.toObjectMetadataId === relation.relation.toObjectMetadataId
    );
  });
  console.log("Relations to create:", relationsToCreate);
  if (relationsToCreate.length > 0) {
    try {
      await createRelations(relationsToCreate, apiToken);
    } catch (error) {
      // If error indicates relation exists, ignore it
      if (!error.message?.includes('already exists')) {
        throw error;
      }
    }
  }
  }


  async batchCheckExistingCandidates(uniqueStringKeys: string[], jobId: string, apiToken: string): Promise<Map<string, any>> {
    const graphqlQuery = JSON.stringify({
      query: allGraphQLQueries.graphqlQueryToFindCandidateByUniqueKey,
      variables: {
        filter: { 
          uniqueStringKey: { in: uniqueStringKeys },
          jobsId: { eq: jobId }
        }
      }
    });
    console.log("Graphql Query:", graphqlQuery);
    const response = await axiosRequest(graphqlQuery, apiToken);
    console.log("Raw axios response:", response.data);
    console.log("Response candidate edges:", response.data?.data?.candidates?.edges);
    const candidatesMap = new Map<string, any>();
    if (!response?.data?.data?.candidates?.edges) {
      console.log("No candidates found in response");  // Add this
      return candidatesMap;
    }
    response.data?.data?.candidates?.edges?.forEach((edge: any) => {
      if (edge?.node?.uniqueStringKey) {
        candidatesMap.set(edge.node.uniqueStringKey, edge.node);
      }
    });
    console.log("CandidatesMap is a response Data:", candidatesMap);
    return candidatesMap;
  }

  private async batchCheckExistingJobCandidates(
    personIds: string[], 
    candidateIds: string[], 
    jobId: string,
    jobObject: any,
    apiToken: string
): Promise<Map<string, any>> {
    if (!personIds.length || !candidateIds.length) {
        return new Map();
    }

    const path_position = JobCandidateUtils.getJobCandidatePathPosition(jobObject.name, jobObject?.arxenaSiteId);
    const graphqlQueryStr = JobCandidateUtils.generateFindManyJobCandidatesQuery(path_position);
    
    // Create an array of AND conditions for each person-candidate-job combination
    const andConditions: { and: { personId?: { eq: string }; candidateId?: { eq: string }; jobId?: { eq: string } }[] }[] = [];
    for (let i = 0; i < personIds.length; i++) {
        andConditions.push({
            and: [
                { personId: { eq: personIds[i] } },
                { candidateId: { eq: candidateIds[i] } },
                { jobId: { eq: jobId } }
            ]
        });
    }

    const graphqlQuery = JSON.stringify({
        variables: {
            filter: {
                or: andConditions
            }
        },
        query: graphqlQueryStr
    });

    try {
        const response = await axiosRequest(graphqlQuery, apiToken);
        const jobCandidatesMap = new Map<string, any>();

        // Get the correct path to the edges based on the response structure
        const pluralObjectName = `${path_position}JobCandidates`;
        const edges = response?.data?.data?.[pluralObjectName]?.edges;

        if (!edges || !Array.isArray(edges)) {
            console.log('No valid edges found in response:', response?.data);
            return jobCandidatesMap;
        }

        edges.forEach((edge: any) => {
            if (edge?.node) {
                const node = edge.node;
                const compositeKey = `${node.person?.id}_${node.candidate?.id}_${node.jobId}`;
                jobCandidatesMap.set(compositeKey, node);
            }
        });

        console.log("JobCandidatesMap created with size:", jobCandidatesMap.size);
        console.log("JobCandidatesMap contents:", jobCandidatesMap);

        return jobCandidatesMap;
    } catch (error) {
        console.error('Error fetching existing job candidates:', error);
        console.error('Query that failed:', graphqlQuery);
        return new Map();
    }
}
  private async collectJobCandidateFields(data: CandidateSourcingTypes.UserProfile[], jobObject: CandidateSourcingTypes.Jobs): Promise<Set<string>> {
    const fields = new Set<string>();
    
    // Add predefined fields
    newFieldsToCreate.forEach(field => fields.add(field));
    
    // Process each profile to get actual jobCandidateNode fields
    for (const profile of data) {
      if (profile) {
        try {
          const { jobCandidateNode } = await processArxCandidate(profile, jobObject);
          // Add all keys from the jobCandidateNode
          Object.keys(jobCandidateNode).forEach(key => fields.add(key));
        } catch (error) {
          console.log(`Error processing profile for fields collection: ${error}`);
          continue;
        }
      }
    }
    return fields;
  }

  delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  private async processBatches(
    data: CandidateSourcingTypes.UserProfile[],
    jobObject: CandidateSourcingTypes.Jobs,
    context: any,
    tracking: any,
    apiToken: string
  ): Promise<{
    manyPersonObjects: CandidateSourcingTypes.ArxenaPersonNode[];
    manyCandidateObjects: CandidateSourcingTypes.ArxenaCandidateNode[];
    allPersonObjects: allDataObjects.PersonNode[];
    manyJobCandidateObjects: CandidateSourcingTypes.ArxenaJobCandidateNode[];
  }> {
    const results = {
      manyPersonObjects: [] as CandidateSourcingTypes.ArxenaPersonNode[],
      allPersonObjects: [] as allDataObjects.PersonNode[],
      manyCandidateObjects: [] as CandidateSourcingTypes.ArxenaCandidateNode[],
      manyJobCandidateObjects: [] as CandidateSourcingTypes.ArxenaJobCandidateNode[]
    };
  
    
    await this.delay(1000);

    const batchSize = 15;
  
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const uniqueStringKeys = batch.map(p => p?.unique_key_string).filter(Boolean);
  
      if (uniqueStringKeys.length === 0) continue;
  
      await this.processPeopleBatch(batch, uniqueStringKeys, results, tracking, apiToken);
      await this.processCandidatesBatch(batch, jobObject, results, tracking, apiToken);
      await this.processJobCandidatesBatch(
        batch,
        jobObject,
        context.jobCandidateInfo.path_position,
        results,
        tracking,
        apiToken
      );
  
      if (i + batchSize < data.length) {
        await this.delay(1000);
      }
    }
    return results;
  }

  private async setupProcessingContext (
    jobObject: CandidateSourcingTypes.Jobs,
    timestamp: string,
    data: CandidateSourcingTypes.UserProfile[],
    apiToken: string
  ): Promise<{ context: any; batchKey: string }> {
    const batchKey = `${jobObject.id}-${timestamp}`;
    let context = this.processingContexts.get(batchKey);
    
    if (!context) {
      const jobCandidateInfo = await this.setupJobCandidateStructure(jobObject, apiToken);
      if (!jobCandidateInfo.jobCandidateObjectId) {
        console.log('Failed to create/get job candidate object structure');
      }

      await this.delay(1000);
  
      context = { jobCandidateInfo, timestamp };
      this.processingContexts.set(batchKey, context);

      if (jobCandidateInfo.jobCandidateObjectId && data.length > 0) {
        await this.createObjectFieldsAndRelations(
          jobCandidateInfo.jobCandidateObjectId,
          jobCandidateInfo.jobCandidateObjectName,
          data,
          jobObject,
          apiToken
        );
      }
    }
  
    return { context, batchKey };
  }
  async processProfilesWithRateLimiting(
    data: CandidateSourcingTypes.UserProfile[],
    jobId: string,
    jobName: string,
    timestamp: string,
    apiToken: string
  ): Promise<{
    // manyPersonObjects: CandidateSourcingTypes.ArxenaPersonNode[];
    // manyCandidateObjects: CandidateSourcingTypes.ArxenaCandidateNode[];
    // allPersonObjects: allDataObjects.PersonNode[];
    // manyJobCandidateObjects: CandidateSourcingTypes.ArxenaJobCandidateNode[];
    timestamp: string;
  }> {
  // ): Promise<{
  //   manyPersonObjects: CandidateSourcingTypes.ArxenaPersonNode[];
  //   manyCandidateObjects: CandidateSourcingTypes.ArxenaCandidateNode[];
  //   allPersonObjects: allDataObjects.PersonNode[];
  //   manyJobCandidateObjects: CandidateSourcingTypes.ArxenaJobCandidateNode[];
  //   timestamp: string;
  // }> {
    console.log("Queue has begun to be processed. ")
    try {
      const jobObject = await this.jobService.getJobDetails(jobId, jobName, apiToken);
      if (!jobObject) {
        console.log('Job not found');
      }
  
      const tracking = {
        personIdMap: new Map<string, string>(),
        candidateIdMap: new Map<string, string>()
      };
      await this.delay(1000);
      const { context, batchKey } = await this.setupProcessingContext(jobObject, timestamp, data, apiToken);
      await this.delay(1000);
      const results = await this.processBatches(data, jobObject, context, tracking, apiToken);
      console.log("This is the context:", context);
      console.log("This is the batch key:", batchKey);
      // Cleanup context after processing is complete
      this.processingContexts.delete(batchKey);
  
      // return { ...results, timestamp };
      return { timestamp };
    } catch (error) {
      console.error('Error in profile processing:', error);
      throw error;
    }
  }
  
  // Helper methods to break down the logic:
  
  private async setupJobCandidateStructure(jobObject: CandidateSourcingTypes.Jobs, apiToken: string) {
    const path_position = JobCandidateUtils.getJobCandidatePathPosition(jobObject.name, jobObject?.arxenaSiteId);
    const jobCandidateObjectName = `${path_position}JobCandidate`;
    const objectsNameIdMap = await new CreateMetaDataStructure(this.workspaceQueryService).fetchObjectsNameIdMap(apiToken);
    let jobCandidateObjectId = objectsNameIdMap[jobCandidateObjectName];
    console.log("There is an existing jobCandidateObjectId:", jobCandidateObjectId);
    if (!jobCandidateObjectId) {
      jobCandidateObjectId = await this.createNewJobCandidateObject(jobObject, apiToken);
    }
    return { jobCandidateObjectId, jobCandidateObjectName, path_position };
  }
  
  private async processPeopleBatch(
    batch: CandidateSourcingTypes.UserProfile[],
    uniqueStringKeys: string[],
    results: any,
    tracking: any,
    apiToken: string
  ) {
    try {
      console.log("This is tracking in processPeopleBatch:", tracking);

      const personDetailsMap = await this.personService.batchGetPersonDetailsByStringKeys(uniqueStringKeys, apiToken);
      console.log("Person Details Map:", personDetailsMap);
      const peopleToCreate:CandidateSourcingTypes.ArxenaPersonNode[] = [];
      const peopleKeys:string[] = [];
    
      for (const profile of batch) {
        const key = profile?.unique_key_string;
        if (!key) continue;
        
        const personObj = personDetailsMap?.get(key);

        const { personNode } = await processArxCandidate(profile, null);
        
        if (!personObj || !personObj?.name) {
          console.log('Person object not found:', profile?.unique_key_string);
          peopleToCreate.push(personNode);
          peopleKeys.push(key);
          results.manyPersonObjects.push(personNode);
        } else {
          results.allPersonObjects.push(personObj);
          tracking.personIdMap.set(key, personObj.id);
        }
      }
    
      console.log('People to create:', peopleToCreate.length);
      if (peopleToCreate.length > 0) {
        const response = await this.personService.createPeople(peopleToCreate, apiToken);
        response?.data?.data?.createPeople?.forEach((person, idx) => {
          if (person?.id) {
            tracking.personIdMap.set(peopleKeys[idx], person.id);
          }
        });
      }
    } catch (error) {
      console.log('Error processing people batch1:', error.data);
      console.log('Error processing people batch2:', error.message);
    }
  }
  private async processCandidatesBatch(
    batch: CandidateSourcingTypes.UserProfile[],
    jobObject: CandidateSourcingTypes.Jobs,
    results: any,
    tracking: any,
    apiToken: string
  ) {
    try {
      console.log("This is tracking in processCandidatesBatch:")
      
      const uniqueStringKeys = batch.map(p => p?.unique_key_string).filter(Boolean);
      
      console.log("Checking candidates with keys:", uniqueStringKeys);
      const candidatesMap = await this.batchCheckExistingCandidates(uniqueStringKeys, jobObject.id, apiToken);
      console.log('Candidates map:', candidatesMap);
      const candidatesToCreate:CandidateSourcingTypes.ArxenaCandidateNode[] = [];
      const candidateKeys:string[] = [];
      
      
      for (const profile of batch) {
        const key = profile?.unique_key_string;
        if (!key) continue;
    
        const existingCandidate = candidatesMap.get(key);
        // console.log('Existing candidate:', existingCandidate);
        const personId = tracking.personIdMap.get(key);
        console.log('Person ID:', personId);
        if (personId && !existingCandidate) {
          const { candidateNode } = await processArxCandidate(profile, jobObject);
          // console.log("Candidate Node:", candidateNode, "for pro  file:", profile);
          candidateNode.peopleId = personId;
          candidatesToCreate.push(candidateNode);
          candidateKeys.push(key);
          results.manyCandidateObjects.push(candidateNode);
        } else if (existingCandidate) {
          tracking.candidateIdMap.set(key, existingCandidate.id);
        }
      }

      console.log('Candidates to create:', candidatesToCreate.length);
      console.log('Candidates candidateKeys:', candidateKeys);
      console.log('tracking.candidateIdMap:', tracking.candidateIdMap);
    
      if (candidatesToCreate.length > 0) {
        const response = await this.createCandidates(candidatesToCreate, apiToken);
        console.log('Create candidates response:', response?.data);
        response?.data?.data?.createCandidates?.forEach((candidate: { id: any; }, idx: string | number) => {
          if (candidate?.id) {
            tracking.candidateIdMap.set(candidateKeys[idx], candidate.id);
          }
        });
      }
    } catch (error) {
      console.log('Error processing candidates batch:1', error.data);
      console.log('Error processing candidates batch:2', error);
      console.log('Error processing candidates batch:3', error?.response?.data);
      console.log('Error processing candidates batch:4', error.message);
    }
  }
  
  private async processJobCandidatesBatch(
    batch: CandidateSourcingTypes.UserProfile[],
    jobObject: CandidateSourcingTypes.Jobs,
    path_position: string,
    results: any,
    tracking: any,
    apiToken: string
) {
    const jobCandidatesToCreate: CandidateSourcingTypes.ArxenaJobCandidateNode[] = [];
    const processedKeys = new Set<string>();
    
    // Get array of personIds and candidateIds
    const validProfiles = batch.filter(profile => {
        const personId = tracking.personIdMap.get(profile?.unique_key_string);
        const candidateId = tracking.candidateIdMap.get(profile?.unique_key_string);
        return personId && candidateId;
    });

    const personIds = validProfiles.map(profile => 
        tracking.personIdMap.get(profile?.unique_key_string)
    );
    const candidateIds = validProfiles.map(profile => 
        tracking.candidateIdMap.get(profile?.unique_key_string)
    );

    console.log("Checking job candidates with the following IDs:");
  console.log("Person IDs:", personIds);
  console.log("Candidate IDs:", candidateIds);
  console.log("Job ID:", jobObject.id);


    
    const existingJobCandidates = await this.batchCheckExistingJobCandidates(
        personIds,
        candidateIds,
        jobObject.id,
        jobObject,
        apiToken
    );

    for (const profile of batch) {
        const personId = tracking.personIdMap.get(profile?.unique_key_string);
        const candidateId = tracking.candidateIdMap.get(profile?.unique_key_string);
        
        if (!personId || !candidateId) continue;

        const compositeKey = `${personId}_${candidateId}_${jobObject.id}`;
        
        // Skip if we've already processed this combination or if it already exists
        if (processedKeys.has(compositeKey) || existingJobCandidates.has(compositeKey)) {
            continue;
        }

        processedKeys.add(compositeKey);
        
        try {
            const { jobCandidateNode } = await processArxCandidate(profile, jobObject);
            jobCandidateNode.personId = personId;
            jobCandidateNode.candidateId = candidateId;
            jobCandidateNode.jobId = jobObject.id;
            
            // Additional validation
            if (!jobCandidateNode.personId || !jobCandidateNode.candidateId || !jobCandidateNode.jobId) {
                continue;
            }

            jobCandidatesToCreate.push(jobCandidateNode);
            results.manyJobCandidateObjects.push(jobCandidateNode);
        } catch (error) {
            console.error(`Error processing job candidate for profile ${profile?.unique_key_string}:`, error);
            continue;
        }
    }
    console.log("Job candidates to create:", jobCandidatesToCreate.length);

    if (jobCandidatesToCreate.length > 0) {
        const query = await new JobCandidateUtils().generateJobCandidatesMutation(path_position);
        const graphqlInput = JSON.stringify({
            query,
            variables: { data: jobCandidatesToCreate }
        });

        try {
            const response = await axiosRequest(graphqlInput, apiToken);
            console.log('Job candidate creation response:', response?.data);
        } catch (error) {
            console.error('Error creating job candidates:', error);
            // Could add retry logic here if needed
        }
    }
}
  async createCandidates(manyCandidateObjects: CandidateSourcingTypes.ArxenaCandidateNode[], apiToken: string): Promise<any> {
    console.log('Creating candidates, count:', manyCandidateObjects?.length);
    
    const graphqlVariables = { data: manyCandidateObjects };
    const graphqlQueryObj = JSON.stringify({
      query: CreateManyCandidates,
      variables: graphqlVariables,
    });

    try {
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      return response;
    } catch (error) {
      console.log('Error in creating candidates1', error?.data);
      console.log('Error in creating candidates2', error?.message);
    }
  }


//   async checkExistingJobCandidate(personId: string, candidateId: string, jobId: string, jobObject:any, apiToken: string): Promise<any> {
//     const path_position = JobCandidateUtils.getJobCandidatePathPosition(jobObject.name, jobObject?.arxenaSiteId);
//     const graphqlQueryStr = JobCandidateUtils.generateFindManyJobCandidatesQuery(path_position);

//     console.log("For jobId:", jobId);
//     const graphqlQuery = JSON.stringify({
//       variables: {
//         filter: {
//           and: [
//             { candidateId: { in: [candidateId] } },
//             { personId: { in: [personId] } },
//             { jobId: { in: [jobId] } }
//           ]
//         },
//         orderBy: [{ position: "AscNullsFirst" }]
//       },
//       query: graphqlQueryStr
//     });

//     const response = await axiosRequest(graphqlQuery, apiToken);
//     const jobCandidate = response.data?.data?.[`${path_position}JobCandidates`]?.edges[0];
//     // console.log("Response from checkExistingJobCandidate:", jobCandidate);
//     // console.log("Response from checkExistingJobCandidate:", response.data);
//     return jobCandidate;
// }


    async getFieldMetadataFromId(fieldMetadataId: string, allDataObjects: any): Promise<{ objectType: string; fieldName: string } | null> {
      // Search through all objects and their fields to find the matching field metadata
      for (const edge of allDataObjects.data.objects.edges) {
        const fieldEdge = edge.node.fields.edges.find((fieldEdge: any) => 
          fieldEdge.node.id === fieldMetadataId
        );
        if (fieldEdge) {

          return {
            objectType: edge.node.nameSingular,
            fieldName: fieldEdge.node.name
          };
        }
      }
      return null;
    }

    applyFilter(value: any, filterValue: any, operand: string) {
      if (value === null || value === undefined) return false;
      
      const stringValue = String(value).toLowerCase();
      const filterStringValue = String(filterValue).toLowerCase();
      
    
      switch (operand) {
        case 'contains':
          return stringValue.includes(filterStringValue);
        case 'equals':
          return stringValue === filterStringValue;
        case 'notEquals':
          return stringValue !== filterStringValue;
        case 'startsWith':
          return stringValue.startsWith(filterStringValue);
        case 'endsWith':
          return stringValue.endsWith(filterStringValue);
        case 'isEmpty':
          return !value || value.length === 0;
        case 'isNotEmpty':
          return value && value.length > 0;
        case 'isGreaterThan':
          return Number(value) > Number(filterValue);
        case 'isLessThan':
          return Number(value) < Number(filterValue);
        case 'in':
          return Array.isArray(filterValue) && filterValue.some(v => 
            String(v).toLowerCase() === stringValue
          );
        case 'notIn':
          return Array.isArray(filterValue) && !filterValue.some(v => 
            String(v).toLowerCase() === stringValue
          );
        default:
          return true;
      }
    }
    
    
     async getFieldValueFromCandidate(candidate: any, fieldMetadataId: string, allDataObjects: any): Promise<any> {
      const fieldMetadata = await this.getFieldMetadataFromId(fieldMetadataId, allDataObjects);
      if (!fieldMetadata) return null;
    
      // Handle nested objects based on the object type
      switch (fieldMetadata.objectType) {
        case 'groupHrHeadJobCandidate':
          return candidate[fieldMetadata.fieldName];
        case 'person':
          return candidate.person?.[fieldMetadata.fieldName];
        case 'candidate':
          return candidate.candidate?.[fieldMetadata.fieldName];
        default:
          return candidate[fieldMetadata.fieldName];
      }
    }
    

    async filterCandidatesBasedOnView(allJobCandidates: any[], currentViewWithCombinedFiltersAndSorts: any, allDataObjects: any): Promise<string[]> {
      // If no filters, return all candidates
      if (!currentViewWithCombinedFiltersAndSorts?.viewFilters?.length) {
        return allJobCandidates.map((candidate: any) => candidate.candidate.id);
      }
    
      // Get the filters
      const filters = currentViewWithCombinedFiltersAndSorts.viewFilters;
      console.log("allJobCandidates length:", allJobCandidates.length);
      // Filter candidates based on each filter
      const filteredCandidates: any[] = [];
      
      for (const candidate of allJobCandidates) {
        let matchesAllFilters = true;
        
        for (const filter of filters) {
          const { fieldMetadataId, value, operand } = filter;
          const fieldValue = await this.getFieldValueFromCandidate(candidate, fieldMetadataId, allDataObjects);
          const isFiltered = this.applyFilter(fieldValue, value, operand);
          
          if (!isFiltered) {
            matchesAllFilters = false;
            break;
          }
        }
        
        if (matchesAllFilters) {
          filteredCandidates.push(candidate);
        }
      }
    
      return Array.from(new Set(filteredCandidates.map((candidate: any) => candidate.candidate.id)));
    }
        
    async findManyJobCandidatesWithCursor(path_position: string, apiToken: string): Promise<CandidateSourcingTypes.ArxenaJobCandidateNode[]> {
      const graphqlQueryStr = JobCandidateUtils.generateFindManyJobCandidatesQuery(path_position);
      let cursor = null;
      let hasNextPage = true;
      const allJobCandidates: CandidateSourcingTypes.ArxenaJobCandidateNode[] = [];
      const MAX_ITERATIONS = 100;
      let iterations = 0;
    
      // Get the exact query key that will be in the response
      const queryKey = `${path_position}JobCandidates`;
    
      while (hasNextPage && iterations < MAX_ITERATIONS) {
        try {
          const graphqlQuery = JSON.stringify({
            variables: {
              filter: {},
              orderBy: [{ position: "AscNullsFirst" }],
              lastCursor: cursor,
              limit: 60
            },
            query: graphqlQueryStr
          });
    
          const response = await axiosRequest(graphqlQuery, apiToken);
          const jobCandidatesData = response.data?.data?.[queryKey];
    
          if (!jobCandidatesData) {
            console.error(`No data found for key: ${queryKey}`);
            break;
          }
    
          const jobCandidates = jobCandidatesData.edges || [];
          
          if (jobCandidates.length === 0) {
            break;
          }
    
          allJobCandidates.push(...jobCandidates.map(edge => edge.node));
          
          hasNextPage = jobCandidatesData.pageInfo?.hasNextPage || false;
          cursor = jobCandidatesData.pageInfo?.endCursor;
    
          if (!cursor && hasNextPage) {
            console.warn('No cursor received but hasNextPage is true');
            break;
          }
    
          iterations++;
          console.log(`Fetched ${allJobCandidates.length} of ${jobCandidatesData.totalCount} total records`);
    
        } catch (error) {
          console.error('Error fetching job candidates:', error);
          break;
        }
      }
    
      if (iterations >= MAX_ITERATIONS) {
        console.warn(`Reached maximum number of iterations (${MAX_ITERATIONS})`);
      }
    
      return allJobCandidates;
    }
    
async createNewJobCandidateObject(newPositionObj: CandidateSourcingTypes.Jobs, apiToken: string): Promise<string> {
  console.log("Creating new job candidate object structure::", newPositionObj);
  const path_position = JobCandidateUtils.getJobCandidatePathPosition(newPositionObj.name, newPositionObj?.arxenaSiteId);
  // First, check if the object already exists
  const objectsNameIdMap = await new CreateMetaDataStructure(this.workspaceQueryService).fetchObjectsNameIdMap(apiToken);
  const jobCandidateObjectName = `${path_position}JobCandidate`;
  
  if (objectsNameIdMap[jobCandidateObjectName]) {
    console.log("Job candidate object already exists, returning existing ID");
    return objectsNameIdMap[jobCandidateObjectName];
  }
  
  // If it doesn't exist, create new object
  const jobCandidateObject = JobCandidateUtils.createJobCandidateObject(newPositionObj.name, path_position);
  console.log("Jpath_position:", path_position);
  console.log("Job candidate object:", jobCandidateObject);
  
  const input = {
    object: jobCandidateObject.object
  };

  const mutation = {
    query: allGraphQLQueries.graphqlToCreateOneMetatDataObjectItems,
    variables: { input }
  };
  let jobCandidateObjectId = '';
  try {
    const responseFromMetadata = await axiosRequestForMetadata(JSON.stringify(mutation), apiToken);
    const newObjectId = responseFromMetadata.data?.data?.createOneObject?.id;
    console.log("New object id created :::", newObjectId);
    jobCandidateObjectId = newObjectId;
    if (!newObjectId) {
      console.log('Error creating object:', responseFromMetadata.data?.errors);
      const updatedObjectsMap = await new CreateMetaDataStructure(this.workspaceQueryService).fetchObjectsNameIdMap(apiToken);
      if (updatedObjectsMap[jobCandidateObjectName]) {
        jobCandidateObjectId = updatedObjectsMap[jobCandidateObjectName];
      }
      console.log('Error creating or finding object:');
    } else {
      console.log('Successfully created object with ID:', newObjectId);
    }
  } catch (error) {
    console.log('Error creating object with error message:', error.message);
    if (error.message?.includes('duplicate key value')) {
      const finalObjectsMap = await new CreateMetaDataStructure(this.workspaceQueryService).fetchObjectsNameIdMap(apiToken);
      if (finalObjectsMap[jobCandidateObjectName]) {
        jobCandidateObjectId = finalObjectsMap[jobCandidateObjectName];
      }
    }
    console.log('Error creating object:', error);
  }
  
  await this.createRelationsBasedonObjectMap(jobCandidateObjectId, jobCandidateObjectName, apiToken);
  return jobCandidateObjectId;
}

getIconForFieldType = (fieldType: string): string => {
  const iconMap: Record<string, string> = {
    'Number': 'IconNumbers',
    'Text': 'IconAbc',
    'Boolean': 'IconToggleRight',
    'DateTime': 'IconCalendar',
    'Select': 'IconSelect',
    'Link': 'IconLink',
    'RawJson': 'IconJson'
  };
  
  return iconMap[fieldType] || 'IconAbc'; // Default to text icon if type not found
};


private createFieldDefinition(fieldName: string, objectMetadataId: string): any {
  const fieldType = this.determineFieldType(fieldName);
  console.log("Field Type Created:", fieldType, "for field:", fieldName);
  const fieldsCreator = new CreateFieldsOnObject();
  const icon = fieldType === 'Number' ? 'IconNumbers' : 'IconAbc';

  // Add validation
  const methodName = `create${fieldType}`;
  if (!(methodName in fieldsCreator)) {
    console.warn(`Method ${methodName} not found in CreateFieldsOnObject, defaulting to TextField`);
    return fieldsCreator.createTextField({
      label: this.formatFieldLabel(fieldName),
      name: fieldName,
      objectMetadataId: objectMetadataId,
      description: this.formatFieldLabel(fieldName),
      icon: this.getIconForFieldType(fieldType)
    });
  }
  
  try {
    return fieldsCreator[methodName]({
      label: this.formatFieldLabel(fieldName),
      name: fieldName,
      objectMetadataId: objectMetadataId,
      description: this.formatFieldLabel(fieldName)
    });
  } catch (error) {
    console.error(`Error creating field ${fieldName} of type ${fieldType}:`, error);
    // Fallback to TextField if there's an error
    return fieldsCreator.createTextField({
      label: this.formatFieldLabel(fieldName),
      name: fieldName,
      objectMetadataId: objectMetadataId,
      description: this.formatFieldLabel(fieldName)
    });
  }
}

private determineFieldType(fieldName: string): string {
  // Match exact method names in CreateFieldsOnObject
  if (fieldName.includes('year') || 
      fieldName.includes('months') || 
      fieldName.includes('lacs') || 
      fieldName.includes('thousands') || 
      fieldName.includes('experienceYears') ||
      fieldName.includes('experienceMonths') ||
      fieldName.includes('ugGraduationYear') ||
      fieldName.includes('pgGraduationYear') ||
      fieldName.includes('age') ||
      fieldName.includes('inferredSalary')) {
    return 'NumberField'; // Instead of 'NumberField'
  }
  
  if (fieldName.includes('link') || 
      fieldName.includes('profileUrl') || 
      fieldName.includes('displayPicture')) {
    return 'LinkField';  // Instead of 'LinkField'
  }
  
  if (fieldName.includes('multi') || 
      fieldName.includes('skills') ||
      fieldName.includes('locations')) {
    return 'SelectField';  // Instead of 'MultiField'
  }
  
  return 'TextField'; // Instead of 'TextField'
}

private async createFieldsWithRetry(fields: { field: any }[], apiToken: string): Promise<void> {
  const maxRetries = 3;
  const batchSize = 10; // Adjust based on your API limits
  
  // Split fields into batches
  for (let i = 0; i < fields.length; i += batchSize) {
    const batch = fields.slice(i, i + batchSize);
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        await createFields(batch, apiToken);
        console.log(`Successfully created batch of ${batch.length} fields`);
        break;
      } catch (error) {
        if (error.message?.includes('duplicate key value')) {
          console.log('Duplicate key detected, skipping batch');
          break;
        }

        retryCount++;
        if (retryCount === maxRetries) {
          console.log('Failed to create fields batch after max retries:', error);
          throw error;
        }

        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`Retry ${retryCount} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}


private async fetchAllFieldsForObject(objectId: string, apiToken: string): Promise<string[]> {
  const fields: string[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    try {
      const response = await new CreateMetaDataStructure(this.workspaceQueryService).fetchFieldsPage(objectId, cursor, apiToken);
      console.log("This is the resposne data objects:", response?.data?.objects);
      
      const objectFields = response?.data?.objects?.edges
        ?.find(x => x?.node?.id === objectId)?.node?.fields?.edges;
      console.log("thsese are obejct fields:", objectFields);
      if (!objectFields) {
        console.log('Could not find object fields');
      }

      const currentFields = objectFields
        .map(edge => edge?.node?.name)
        .filter((name): name is string => !!name);
      
      console.log("Current fields:", currentFields);

      fields.push(...currentFields);

      console.log(`Fetched ${currentFields.length} fields, total: ${fields.length}`);

      const pageInfo = response?.data?.objects?.pageInfo;
      hasNextPage = pageInfo?.hasNextPage || false;
      cursor = pageInfo?.endCursor || null;

      if (!hasNextPage) break;
    } catch (error) {
      console.error('Error fetching fields page:', error);
      throw error;
    }
  }
  console.log("Total fields fetched:", fields.length);
  console.log("All Fields fetched:", fields);

  return fields;
}


private formatFieldLabel(fieldName: string): string {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, l => l.toUpperCase())
    .trim();
}

  private extractKeysFromObjects(objects: CandidateSourcingTypes.ArxenaJobCandidateNode): string[] {
    const keys = new Set<string>();
    [objects].forEach(obj => {
      Object.keys(obj).forEach(key => keys.add(key));
    });
    return Array.from(keys);
  }

  private async createObjectFieldsAndRelations(
    jobCandidateObjectId: string,
    jobCandidateObjectName: string,
    data: CandidateSourcingTypes.UserProfile[],
    jobObject: CandidateSourcingTypes.Jobs,
    apiToken: string,
  ): Promise<void> {
    // Acquire semaphore for entire field creation process
      // Add retry logic for fetching existing fields
      const existingFields = await this.fetchAllFieldsForObject(jobCandidateObjectId, apiToken);
      console.log("Total existing fields found:", existingFields.length);
      console.log("Existing field names:", existingFields);
      await this.delay(1000);
      // Get all required fields
      const allFields = await this.collectJobCandidateFields(data, jobObject);
      console.log("Total required fields:", allFields.size);
      console.log("Required field names:", Array.from(allFields));
      await this.delay(1000);
      // Filter out existing fields and create field definitions
      const newFields = Array.from(allFields)
        .filter(field => !existingFields.includes(field))
        .filter(field => !['name', 'createdAt', 'updatedAt'].includes(field))
        .map(field => ({
          field: this.createFieldDefinition(field, jobCandidateObjectId)
        }));
  
      console.log("New fields to create:", newFields.length);
      console.log("New field names:", newFields.map(x => x.field.name));
      console.log("New field names:", newFields.map(x => x.field?.type));
      await this.delay(1000);
      // Create fields in batches with retries
      if (newFields.length > 0) {
        await this.delay(500);

        await this.createFieldsWithRetry(newFields, apiToken);
      }
  
  }
}