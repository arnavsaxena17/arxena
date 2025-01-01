import { ConsoleLogger, Injectable } from '@nestjs/common';
import { JobService } from './job.service';
import { PersonService } from './person.service';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { axiosRequest, axiosRequestForMetadata } from '../utils/utils';
// import { newFieldsToCreate } from '../utils/data-transformation-utility';

import { CreateManyCandidates } from '../graphql-queries';
import { processArxCandidate } from '../utils/data-transformation-utility';
import * as CandidateSourcingTypes from '../types/candidate-sourcing-types';
import { JobCandidateUtils } from '../utils/job-candidate-utils';
import { CreateMetaDataStructure } from '../../workspace-modifications/object-apis/object-apis-creation';
import { createObjectMetadataItems } from '../../workspace-modifications/object-apis/services/object-service';
import { createFields } from '../../workspace-modifications/object-apis/services/field-service';
import { createRelations } from '../../workspace-modifications/object-apis/services/relation-service';
import * as allGraphQLQueries from '../../arx-chat/services/candidate-engagement/graphql-queries-chatbot';
import {CreateFieldsOnObject} from 'src/engine/core-modules/workspace-modifications/object-apis/data/createFields';
import * as allDataObjects from '../../arx-chat/services/data-model-objects';
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>(resolve => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    if (this.waiting.length > 0) {
      const next = this.waiting.shift();
      next?.();
    } else {
      this.permits++;
    }
  }
}



export const newFieldsToCreate = [
  "name",
  "jobTitle",
  "currentOrganization",
  "age",
  "currentLocation",
  "inferredSalary",
  "email",
  "profileUrl",
  "phone",
  "uniqueStringKey",
  "profileTitle",
  "displayPicture",
  "preferredLocations",
  "birthDate",
  "inferredYearsExperience",
  "noticePeriod",
  "homeTown",
  "maritalStatus",
  "ugInstituteName",
  "ugGraduationYear",
  "pgGradudationDegree",
  "ugGraduationDegree",
  "pgGraduationYear",
  "resumeHeadline",
  "keySkills",
  "industry",
  "modifyDateLabel",
  "experienceYears",
  "experienceMonths",
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


  async batchCheckExistingJobCandidates(
    personIds: string[], 
    candidateIds: string[], 
    jobId: string,
    jobObject: any,
    apiToken: string
  ): Promise<Map<string, any>> {
    const path_position = JobCandidateUtils.getJobCandidatePathPosition(jobObject.name, jobObject?.arxenaSiteId);
    const graphqlQueryStr = JobCandidateUtils.generateFindManyJobCandidatesQuery(path_position);
    
    const graphqlQuery = JSON.stringify({
      variables: {
        filter: {
          and: [
            { candidateId: { in: candidateIds } },
            { personId: { in: personIds } },
            { jobId: { in: [jobId] } }
          ]
        },
        orderBy: [{ position: "AscNullsFirst" }]
      },
      query: graphqlQueryStr
    });
  
    const response = await axiosRequest(graphqlQuery, apiToken);
    const jobCandidatesMap = new Map<string, any>();
    
    // Create a composite key using personId and candidateId
    response.data?.data?.[`${path_position}JobCandidates`]?.edges?.forEach((edge: any) => {
      const compositeKey = `${edge.node.personId}_${edge.node.candidateId}`;
      jobCandidatesMap.set(compositeKey, edge.node);
    });
  
    return jobCandidatesMap;
  }
  // Add semaphores for concurrency control
private setupSemaphore = new Semaphore(1); // Only allow one setup at a time
private dbSemaphore = new Semaphore(3); // Allow 3 concurrent batch operations

  // In CandidateService

 async processProfilesWithRateLimiting(
    data: CandidateSourcingTypes.UserProfile[], 
    jobObject: CandidateSourcingTypes.Jobs,
    timestamp: string, // Add timestamp parameter
    apiToken: string
  ): Promise<{ 
    manyPersonObjects: CandidateSourcingTypes.ArxenaPersonNode[];  
    manyCandidateObjects: CandidateSourcingTypes.ArxenaCandidateNode[]; 
    allPersonObjects: allDataObjects.PersonNode[];
    manyJobCandidateObjects: CandidateSourcingTypes.ArxenaJobCandidateNode[];
    timestamp: string; // Include timestamp in response
  }> {
    const results = {
      manyPersonObjects: [] as CandidateSourcingTypes.ArxenaPersonNode[],
      allPersonObjects: [] as allDataObjects.PersonNode[],
      manyCandidateObjects: [] as CandidateSourcingTypes.ArxenaCandidateNode[],
      manyJobCandidateObjects: [] as CandidateSourcingTypes.ArxenaJobCandidateNode[],
      timestamp: timestamp // Add timestamp to results
    };
  
    const tracking = {
      personIdMap: new Map<string, string>(),
      candidateIdMap: new Map<string, string>()
    };
  
    try {
      // Use timestamp as unique identifier for this processing batch
      const batchKey = `${jobObject.id}-${timestamp}`;
      let context = this.processingContexts.get(batchKey);
  
      if (!context) {
        await this.setupSemaphore.acquire();
        try {
          const jobCandidateInfo = await this.setupJobCandidateStructure(jobObject, apiToken);
          if (!jobCandidateInfo.jobCandidateObjectId) {
            throw new Error('Failed to create/get job candidate object structure');
          }
  
          context = {
            jobCandidateInfo,
            timestamp
          };

          this.processingContexts.set(batchKey, context);
          console.log("Job Candidate Info:", jobCandidateInfo);
          console.log("Job this.processingContexts Info:", this.processingContexts);
  
          // Set up metadata fields if needed
          if (jobCandidateInfo.jobCandidateObjectId && data.length > 0) {
            await this.createObjectFieldsAndRelations(
              jobCandidateInfo.jobCandidateObjectId,
              jobCandidateInfo.jobCandidateObjectName,
              data,
              jobObject,
              apiToken
            );
          }
        } finally {
          this.setupSemaphore.release();
        }
      }
  
      // Rest of the processing with batches...
      const batchSize = 15;
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const uniqueStringKeys = batch.map(p => p?.unique_key_string).filter(Boolean);
  
        if (uniqueStringKeys.length === 0) continue;
  
        await this.dbSemaphore.acquire();
        try {
          await this.processPeopleBatch(batch, uniqueStringKeys, results, tracking, apiToken);
          await this.processCandidatesBatch(batch, jobObject, results, tracking, apiToken);
          await this.processJobCandidatesBatch( batch, jobObject, context.jobCandidateInfo.path_position, results, tracking, apiToken );
        } finally {
          this.dbSemaphore.release();
        }
  
        if (i + batchSize < data.length) {
          await delay(1000);
        }
      }
  
      // Cleanup context after processing is complete
      this.processingContexts.delete(batchKey);
  
      return results;
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
    
    if (!jobCandidateObjectId) {
      jobCandidateObjectId = await this.createNewJobCandidateObject(jobObject, apiToken);
      console.log('Created new job candidate object:', jobCandidateObjectId);
      if (jobCandidateObjectId) {
        await this.createRelationsBasedonObjectMap(jobCandidateObjectId, jobCandidateObjectName, apiToken);
      }
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
      const personDetailsMap = await this.personService.batchGetPersonDetailsByStringKeys(uniqueStringKeys, apiToken);
      const peopleToCreate:CandidateSourcingTypes.ArxenaPersonNode[] = [];
      const peopleKeys:string[] = [];
    
      for (const profile of batch) {
        const key = profile?.unique_key_string;
        if (!key) continue;
    
        const personObj = personDetailsMap?.get(key);
        const { personNode } = await processArxCandidate(profile, null);
    
        if (!personObj || !personObj?.name) {
          peopleToCreate.push(personNode);
          peopleKeys.push(key);
          results.manyPersonObjects.push(personNode);
        } else {
          results.allPersonObjects.push(personObj);
          tracking.personIdMap.set(key, personObj.id);
        }
      }
    
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

      
      const uniqueStringKeys = batch.map(p => p?.unique_key_string).filter(Boolean);
      
      console.log("Checking candidates with keys:", uniqueStringKeys);
      const candidatesMap = await this.batchCheckExistingCandidates(uniqueStringKeys, jobObject.id, apiToken);
      console.log('Candidates map:', candidatesMap);
      console.log("Whole batch :", batch);
      const candidatesToCreate:CandidateSourcingTypes.ArxenaCandidateNode[] = [];
      const candidateKeys:string[] = [];
      
      
      for (const profile of batch) {
        const key = profile?.unique_key_string;
        if (!key) continue;
    
        const existingCandidate = candidatesMap.get(key);
        console.log('Existing candidate:', existingCandidate);
        const personId = tracking.personIdMap.get(key);
        console.log('Person ID:', personId);
        if (personId && !existingCandidate) {
          const { candidateNode } = await processArxCandidate(profile, jobObject);
          console.log("Candidate Node:", candidateNode, "for pro  file:", profile);
          candidateNode.personId = personId;
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

    try {
      for (const profile of batch) {
        const key = profile?.unique_key_string;
        if (!key) continue;

        const personId = tracking.personIdMap.get(key);
        const candidateId = tracking.candidateIdMap.get(key);

        console.log("tracking personIdMap:", tracking.personIdMap);
        console.log("tracking candidateIdIdMap:", tracking.candidateIdMap);

        if (personId && candidateId) {
          const { jobCandidateNode } = await processArxCandidate(profile, jobObject);
          console.log("Job Candidate Node:", jobCandidateNode, "for profile:", profile);
          jobCandidateNode.personId = personId;
          jobCandidateNode.candidateId = candidateId;
          jobCandidateNode.jobId = jobObject.id;

          const isDuplicate = results.manyJobCandidateObjects.some((jc: { personId: string | undefined; candidateId: string | undefined; jobId: string | undefined; }) =>
            jc.personId === jobCandidateNode.personId &&
            jc.candidateId === jobCandidateNode.candidateId &&
            jc.jobId === jobCandidateNode.jobId
          );


          if (!isDuplicate) {
            jobCandidatesToCreate.push(jobCandidateNode);
            results.manyJobCandidateObjects.push(jobCandidateNode);
          }
        }
      }

      if (jobCandidatesToCreate.length > 0) {
        console.log("Job Candidates to create:", jobCandidatesToCreate.length);
        const query = await new JobCandidateUtils().generateJobCandidatesMutation(path_position);
        const graphqlInput = JSON.stringify({
          query,
          variables: { data: jobCandidatesToCreate }
        });
  
        console.log('Attempting to create job candidates with query:', graphqlInput);
        try {
          const response = await axiosRequest(graphqlInput, apiToken);
          console.log('Job candidate creation response:', response?.data);
          
          if (response?.data?.errors) {
            console.log('GraphQL errors:', JSON.stringify(response.data.errors, null, 2));
          }
        } catch (error) {
          console.log('Full error object:', JSON.stringify(error, null, 2));
          console.log('Error response data:', error.response?.data);
          console.log('Error request:', {
            query: error.config?.data,
            variables: error.config?.variables 
          });
        }
      }
    } catch (error) {
      console.log('Full error object:', JSON.stringify(error, null, 2));
      console.log('Error response data:', error.response?.data);
      console.log('Error request:', {
        query: error.config?.data,
        variables: error.config?.variables 
      });
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
      console.log('Error in creating candidates3', error);
    }
  }


  async checkExistingJobCandidate(personId: string, candidateId: string, jobId: string, jobObject:any, apiToken: string): Promise<any> {
    const path_position = JobCandidateUtils.getJobCandidatePathPosition(jobObject.name, jobObject?.arxenaSiteId);
    const graphqlQueryStr = JobCandidateUtils.generateFindManyJobCandidatesQuery(path_position);

    console.log("For jobId:", jobId);
    const graphqlQuery = JSON.stringify({
      variables: {
        filter: {
          and: [
            { candidateId: { in: [candidateId] } },
            { personId: { in: [personId] } },
            { jobId: { in: [jobId] } }
          ]
        },
        orderBy: [{ position: "AscNullsFirst" }]
      },
      query: graphqlQueryStr
    });

    const response = await axiosRequest(graphqlQuery, apiToken);
    const jobCandidate = response.data?.data?.[`${path_position}JobCandidates`]?.edges[0];
    // console.log("Response from checkExistingJobCandidate:", jobCandidate);
    // console.log("Response from checkExistingJobCandidate:", response.data);
    return jobCandidate;
}


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

  try {
    const responseFromMetadata = await axiosRequestForMetadata(JSON.stringify(mutation), apiToken);
    const newObjectId = responseFromMetadata.data?.data?.createOneObject?.id;
    console.log("New object id created :::", newObjectId);
    if (!newObjectId) {
      // If creation failed but no error was thrown, check if it exists again
      const updatedObjectsMap = await new CreateMetaDataStructure(this.workspaceQueryService).fetchObjectsNameIdMap(apiToken);
      if (updatedObjectsMap[jobCandidateObjectName]) {
        return updatedObjectsMap[jobCandidateObjectName];
      }
      console.log('Error creating or finding object:');
    }
    
    return newObjectId;
  } catch (error) {
    if (error.message?.includes('duplicate key value')) {
      // If we get here due to a race condition, fetch and return the existing ID
      const finalObjectsMap = await new CreateMetaDataStructure(this.workspaceQueryService).fetchObjectsNameIdMap(apiToken);
      if (finalObjectsMap[jobCandidateObjectName]) {
        return finalObjectsMap[jobCandidateObjectName];
      }
    }
    console.log('Error creating object:', error);
  }
  return ''; // Add a default return statement
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
    try {
      const existingFieldsResponse = await new CreateMetaDataStructure(this.workspaceQueryService)
        .fetchAllCurrentObjects(apiToken);
        
      const existingFields = existingFieldsResponse?.data?.objects?.edges
        ?.filter(x => x?.node?.id == jobCandidateObjectId)[0]?.node?.fields?.edges
        ?.map(edge => edge?.node?.name) || [];
  
      // Get all required fields
      const allFields = new Set([
        ...newFieldsToCreate,
        ...Array.from(this.collectFieldsFromData(data))
      ]);
      console.log("All fields:", allFields);
      // Filter out existing fields
      const newFields = Array.from(allFields)
        .filter(field => !existingFields.includes(field))
        .map(field => ({
          field: this.createFieldDefinition(field, jobCandidateObjectId)
        }));

      console.log("New fields to create:", newFields);
      console.log("New fields to create length:", newFields.length);
  
      // Create fields in smaller batches with retries
      const batchSize = 5;
      for (let i = 0; i < newFields.length; i += batchSize) {
        const batch = newFields.slice(i, i + batchSize);
        let retryCount = 0;
        const maxRetries = 3;
        const filteredFields = batch.filter(field => field.field);
        console.log("Filtered fields:", filteredFields, "for i =", i);
        while (retryCount < maxRetries) {
          try {
            await createFields(filteredFields, apiToken);
            break;
          } catch (error) {
            if (error.message?.includes('duplicate key value')) {
              console.log('Duplicate field detected, skipping');
              break;
            }
            retryCount++;
            if (retryCount === maxRetries) {
              console.log('Failed to create fields after max retries:', error.message);
              // Continue with next batch instead of failing completely
              break;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }
    } catch (error) {
      console.log("Error in createObjectFieldsAndRelations:", error);
      // Don't throw error to allow processing to continue
    }
  }
    
  private collectFieldsFromData(data: CandidateSourcingTypes.UserProfile[]): Set<string> {
    const fields = new Set<string>();
    for (const profile of data) {
      if (profile) {
        Object.keys(profile).forEach(key => fields.add(key));
      }
    }
    return fields;
  }
  
  

}