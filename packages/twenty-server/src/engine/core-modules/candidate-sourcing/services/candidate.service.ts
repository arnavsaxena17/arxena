import { Injectable } from '@nestjs/common';

import axios from 'axios';
import {
  ArxenaCandidateNode,
  ArxenaPersonNode,
  CreateManyCandidateFieldValues,
  CreateManyCandidates,
  createOneCandidateField,
  FindManyVideoInterviewModels,
  getExistingRelationsQuery,
  graphqlQueryToCreateOneCandidateFieldValue,
  graphqlQueryToFindManyCandidateFields,
  graphqlToFetchAllCandidateData,
  graphqlToFindManyCandidateFieldValues,
  graphqlToFindManyJobs,
  graphQltoUpdateOneCandidate,
  Jobs,
  mutationToUpdateOnePerson,
  PersonNode,
  updateCandidateFieldValueMutation,
  UserProfile
} from 'twenty-shared';

import { generateCompleteMappings, processArxCandidate } from 'src/engine/core-modules/candidate-sourcing/utils/data-transformation-utility';
import {
  axiosRequest
} from 'src/engine/core-modules/candidate-sourcing/utils/utils';


import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import { CreateFieldsOnObject } from 'src/engine/core-modules/workspace-modifications/object-apis/data/createFields';
import { CreateMetaDataStructure } from 'src/engine/core-modules/workspace-modifications/object-apis/object-apis-creation';
import { createRelations } from 'src/engine/core-modules/workspace-modifications/object-apis/services/relation-service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

import { PersonService } from './person.service';

import { getRecruiterProfileFromCurrentUser } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';

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
  private processingContexts = new Map<string, ProcessingContext>();
  private candidateFieldsMap = new Map<string, Map<string, { id: string; name: string }>>();

  constructor(
    private readonly personService: PersonService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly jwtWrapperService: JwtWrapperService,
  ) {}

  private async getWorkspaceIdFromToken(apiToken: string): Promise<string> {
    const payload = this.jwtWrapperService.decode(apiToken, { json: true });
    
    if (!payload?.workspaceId) {
      throw new Error('No workspace ID found in token');
    }

    return payload.workspaceId;
  }

  private async initializeCandidateFields(workspaceId: string, apiToken: string) {
    try {
      // Check if we already have fields for this workspace
      if (this.candidateFieldsMap.has(workspaceId)) {
        return;
      }

      const query = graphqlQueryToFindManyCandidateFields;
      const variables = {
        filter: {},
        orderBy: [{ position: 'AscNullsFirst' }],
      };

      const response = await axiosRequest(
        JSON.stringify({ query, variables }),
        apiToken,
      );

      const fields = response.data?.data?.candidateFields?.edges || [];
      const workspaceFieldsMap = new Map<string, { id: string; name: string }>();
      console.log('This is the fields:', fields);
      console.log('This is the fields stringified:', JSON.stringify(fields));
      fields.forEach((field: any) => {
        if (field?.node?.id && field?.node?.name) {
          workspaceFieldsMap.set(field.node.name, {
            id: field.node.id,
            name: field.node.name
          });
        }
      });

      this.candidateFieldsMap.set(workspaceId, workspaceFieldsMap);
      console.log('This is the candidateFieldsMap:', this.candidateFieldsMap);
    } catch (error) {
      console.error('Error initializing candidate fields:', error);
    }
  }

  private async checkExistingRelations(
    objectMetadataId: string,
    apiToken: string,
  ): Promise<any[]> {
    try {


      const response = await axiosRequest(
        JSON.stringify({
          query: getExistingRelationsQuery,
          variables: { objectMetadataId },
        }),
        apiToken,
      );

      return (
        response.data?.data?.relations?.edges?.map((edge: any) => edge.node) ||
        []
      );
    } catch (error) {
      console.error('Error checking existing relations:', error);

      return [];
    }
  }

  async getVideoInterviewModels(apiToken) {
    try {
      const query = FindManyVideoInterviewModels;
      const variables = {
        filter: {},
        orderBy: [{ position: 'AscNullsFirst' }],
      };

      const response = await axiosRequest(
        JSON.stringify({ query, variables }),
        apiToken,
      );

      return response.data?.data?.videoInterviewModels?.edges;
    } catch (error) {
      console.error('Error fetching video interview models:', error);

      return [];
    }
  }

  async createRelationsBasedonObjectMap(
    jobCandidateObjectId: string,
    jobCandidateObjectName: string,
    apiToken: string,
  ): Promise<void> {
    const objectsNameIdMap = await new CreateMetaDataStructure(
      this.workspaceQueryService,
    ).fetchObjectsNameIdMap(apiToken);
    const existingRelations = await this.checkExistingRelations(
      jobCandidateObjectId,
      apiToken,
    );
    const relationsToCreate = [
      {
        relationMetadata: {
          fromObjectMetadataId: objectsNameIdMap['person'],
          toObjectMetadataId: jobCandidateObjectId,
          relationType: 'ONE_TO_MANY' as const,
          fromName: jobCandidateObjectName,
          toName: 'person',
          fromDescription: 'Job Candidate',
          toDescription: 'Person',
          fromLabel: 'Job Candidate',
          toLabel: 'Person',
          fromIcon: 'IconUserCheck',
          toIcon: 'IconUser',
        },
      },
      {
        relationMetadata: {
          fromObjectMetadataId: objectsNameIdMap['candidate'],
          toObjectMetadataId: jobCandidateObjectId,
          relationType: 'ONE_TO_MANY' as const,
          fromName: jobCandidateObjectName,
          toName: 'candidate',
          fromDescription: 'Job Candidate',
          toDescription: 'Candidate',
          fromLabel: 'Job Candidate',
          toLabel: 'Candidate',
          fromIcon: 'IconUserCheck',
          toIcon: 'IconUser',
        },
      },
      {
        relationMetadata: {
          fromObjectMetadataId: objectsNameIdMap['job'],
          toObjectMetadataId: jobCandidateObjectId,
          relationType: 'ONE_TO_MANY' as const,
          fromName: jobCandidateObjectName,
          toName: 'job',
          fromDescription: 'Job Candidate',
          toDescription: 'Job',
          fromLabel: 'Job Candidate',
          toLabel: 'Job',
          fromIcon: 'IconUserCheck',
          toIcon: 'IconUser',
        },
      },
    ].filter((relation) => {
      // Filter out relations that already exist
      return !existingRelations.some(
        (existing) =>
          existing.fromObjectMetadataId ===
            relation.relationMetadata.fromObjectMetadataId &&
          existing.toObjectMetadataId ===
            relation.relationMetadata.toObjectMetadataId,
      );
    });

    console.log('Relations to create:', relationsToCreate);
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

  async batchCheckExistingCandidates(
    uniqueStringKeys: string[],
    jobId: string,
    apiToken: string,
  ): Promise<Map<string, any>> {
    const graphqlQuery = JSON.stringify({
      query: graphqlToFetchAllCandidateData,
      variables: {
        filter: {
          uniqueStringKey: { in: uniqueStringKeys },
          jobsId: { eq: jobId },
        },
      },
    });
    const response = await axiosRequest(graphqlQuery, apiToken);

    console.log('Raw axios response:', response.data);
    console.log(
      'Response candidate edges:',
      response.data?.data?.candidates?.edges,
    );
    const candidatesMap = new Map<string, any>();

    if (!response?.data?.data?.candidates?.edges) {
      console.log('No candidates found in response'); // Add this

      return candidatesMap;
    }
    response.data?.data?.candidates?.edges?.forEach((edge: any) => {
      if (edge?.node?.uniqueStringKey) {
        candidatesMap.set(edge.node.uniqueStringKey, edge.node);
      }
    });
    console.log('CandidatesMap is a response Data:', candidatesMap);

    return candidatesMap;
  }

  private async processBatches(
    data: UserProfile[],
    jobObject: Jobs,
    tracking: any,
    apiToken: string,
  ): Promise<{
    manyPersonObjects: ArxenaPersonNode[];
    manyCandidateObjects: ArxenaCandidateNode[];
    allPersonObjects: PersonNode[];
  }> {
    const results = {
      manyPersonObjects: [] as ArxenaPersonNode[],
      allPersonObjects: [] as PersonNode[],
      manyCandidateObjects: [] as ArxenaCandidateNode[],
    };

    console.log('This is the job object in processBatches:', jobObject);
    if (!jobObject) {
      throw new Error('jobObject is undefined in processBatches');
    }
    if (!jobObject.id) {
      throw new Error(`jobObject.id is undefined in processBatches. jobObject: ${JSON.stringify(jobObject)}`);
    }

    const uniqueStringKeys = data
      .map((p) => p?.unique_key_string)
      .filter(Boolean);

    console.log(
      'These are the unique string keys that are received::',
      uniqueStringKeys,
    );

    await this.processPeopleBatch(
      data,
      uniqueStringKeys,
      results,
      tracking,
      apiToken,
    );

    try {
      await this.processCandidatesBatch(
        data,
        jobObject,
        results,
        tracking,
        apiToken,
      );
    } catch (error) {
      console.error('Error in processCandidatesBatch:', error);
      throw error;
    }

    await this.createCandidateFieldsAndValues(data, jobObject, results, tracking, apiToken);

    return results;
  }

  async createCandidateFieldsAndValues(
    data: any, 
    jobObject: Jobs, 
    results: any, 
    tracking: any, 
    apiToken: string
  ): Promise<void> {
    const workspaceId = await this.getWorkspaceIdFromToken(apiToken);
    
    await this.initializeCandidateFields(workspaceId, apiToken);
    
    const uniqueFields = new Set<string>();
    const fieldValuesToCreate: any[] = [];
    const workspaceFieldsMap = this.candidateFieldsMap.get(workspaceId) || new Map();
    console.log('This is the workspaceFieldsMap:', workspaceFieldsMap);
    console.log('=== Field Processing Summary ===');
    console.log('Total candidates being processed:', data.length);

    for (const candidate of data) {
      console.log('This is the candidate:', candidate);
      const { unmappedCandidateObject, personNode, candidateNode } = await generateCompleteMappings(candidate, jobObject);
      
      if (personNode) {
        console.log('\nFields part of Person object:');
        Object.keys(personNode).forEach(fieldName => {
          console.log(`- ${fieldName}`);
        });
      }

      if (candidateNode) {
        console.log('\nFields part of Candidate object:');
        Object.keys(candidateNode).forEach(fieldName => {
          console.log(`- ${fieldName}`);
        });
      }

      if (unmappedCandidateObject) {
        console.log('\nUnmapped fields:');
        unmappedCandidateObject.forEach((fieldName: any) => {
          console.log(`- ${fieldName.key}`);
          uniqueFields.add(fieldName.key);
        });
      }
    }

    console.log('\nExisting workspace fields:');

    workspaceFieldsMap.forEach((field, name) => {
      console.log(`- ${name} (ID: ${field.id})`);
    });

    console.log('This is the uniqueFields:', uniqueFields);
    console.log('\nProcessing unique fields:');
    for (const fieldName of uniqueFields) {
      if (!workspaceFieldsMap.has(fieldName)) {
        console.log(`\nCreating new field: ${fieldName}`);
        const createFieldQuery = createOneCandidateField;
        const fieldVariables = {
          input: {
            name: fieldName.toString(),
            candidateFieldType: 'Text',
          }
        };

        try {
          const response = await axiosRequest(
            JSON.stringify({ query: createFieldQuery, variables: fieldVariables }),
            apiToken
          );
          console.log('This is the response:', JSON.stringify(response.data.data));

          if (response?.data?.data?.createCandidateField?.id) {
            workspaceFieldsMap.set(fieldName, {
              id: response?.data?.data?.createCandidateField?.id,
              name: fieldName
            });
            console.log(`Successfully created field: ${fieldName} (ID: ${response?.data?.data?.createCandidateField?.id})`);
          }
          console.log('This is the workspaceFieldsMap:', workspaceFieldsMap);
        } catch (error) {
          console.error(`Error creating field ${fieldName}:`, error);
          continue;
        }
      } else {
        console.log(`Field already exists: ${fieldName}`);
      }

      // Collect values for this field from all candidates
    }

    console.log('This is the data:', data);
    console.log('This is the numebr of candidates:', data.length);
    for (const candidate of data) {
      const { unmappedCandidateObject } = await generateCompleteMappings(candidate, jobObject);
      console.log('This is the unmappedCandidateObject:', unmappedCandidateObject);
      const candidateId = tracking.candidateIdMap.get(candidate.unique_key_string);
      console.log('This is the candidateId:', candidateId);
      // for (const fieldName of uniqueFields) {
        // console.log('This is the fieldId:', fieldId);
        
        console.log('This is the unmappedCandidateObject:', unmappedCandidateObject);
        console.log('This is the unmappedCandidateObject length:', unmappedCandidateObject.length);
        unmappedCandidateObject.forEach((field: any) => {
          console.log('This is the field:', field);
          const fieldId = workspaceFieldsMap.get(field.key)?.id;
          console.log('This is the fieldId:', fieldId);
          if (field.value && field.value !== '') {
            // Check if the field value is already in the array
            const isDuplicate = fieldValuesToCreate.some(
            (fv) => fv.name === String(candidate.value) && fv.candidateId === candidateId && fv.candidateFieldsId === fieldId
          );
          if (!isDuplicate) {
            fieldValuesToCreate.push({
              name: typeof candidate[field.key] === 'string' ? candidate[field.key] : JSON.stringify(candidate[field.key]),
              candidateId,
              candidateFieldsId: fieldId
            });
          }
        }
      });
    }
  

    // Update the workspace fields map
    this.candidateFieldsMap.set(workspaceId, workspaceFieldsMap);
    console.log('This is the workspaceFieldsMap:', workspaceFieldsMap);
    console.log('This is the fieldValuesToCreate:', fieldValuesToCreate);
    console.log('This is the number of fieldValuesToCreate:', fieldValuesToCreate.length);
    // Create all field values in batches
    if (fieldValuesToCreate.length > 0) {
      console.log(`\nCreating ${fieldValuesToCreate.length} field values in batches`);
      const batchSize = 100;
      for (let i = 0; i < fieldValuesToCreate.length; i += batchSize) {
        const batch = fieldValuesToCreate.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(fieldValuesToCreate.length/batchSize)}`);
        
        try {
          await axiosRequest(
            JSON.stringify({
              query: CreateManyCandidateFieldValues,
              variables: { data: batch }
            }),
            apiToken
          );
          console.log(`Successfully created batch ${Math.floor(i/batchSize) + 1}`);
          // Add delay between batches to prevent rate limiting
          // await new Promise(resolve => setTimeout(resolve, 150)); // A bit longer than the 100ms window
        } catch (error) {
          console.error('Error creating field values batch:', error);
        }
      }
    }
  }




  async getJobDetails(
    jobId: string,
    jobName: string,
    apiToken: string,
  ): Promise<Jobs> {
    console.log('Getting job details - jobId:', jobId, 'jobName:', jobName);
    function isValidMongoDBId(str: string) {
      if (!str || str.length !== 24) {
        return false;
      }
      const hexRegex = /^[0-9a-fA-F]{24}$/;
      return hexRegex.test(str);
    }
    
    function isValidUUIDv4(str: string) {
      const uuidV4Regex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidV4Regex.test(str);
    }

    let graphlQlQuery: string;
    let queryType = '';

    if (isValidUUIDv4(jobId)) {
      queryType = 'UUID';
      graphlQlQuery = JSON.stringify({
        query: graphqlToFindManyJobs,
        variables: {
          filter: { id: { in: [jobId] } },
          limit: 30,
          orderBy: [{ position: 'AscNullsFirst' }],
        },
      });
    } else if (isValidMongoDBId(jobId)) {
      queryType = 'MongoDB ID';
      graphlQlQuery = JSON.stringify({
        query: graphqlToFindManyJobs,
        variables: {
          filter: { arxenaSiteId: { in: [jobId] } },
          limit: 30,
          orderBy: [{ position: 'AscNullsFirst' }],
        },
      });
    } else if (jobName) {
      queryType = 'Job Name';
      graphlQlQuery = JSON.stringify({
        query: graphqlToFindManyJobs,
        variables: {
          filter: { name: { in: [jobName] } },
          limit: 30,
          orderBy: [{ position: 'AscNullsFirst' }],
        },
      });
    } else {
      throw new Error('Invalid job identifier provided - neither valid ID nor name');
    }

    console.log(`Querying job by ${queryType}`);
    
    try {
      const response = await axiosRequest(graphlQlQuery, apiToken);
      const job = response?.data?.data?.jobs?.edges[0]?.node;
      
      if (!job) {
        console.error('No job found in response:', response?.data);
        throw new Error(`Job not found using ${queryType}`);
      }
      
      if (!job.id) {
        console.error('Invalid job data returned:', job);
        throw new Error('Job found but missing ID');
      }
      
      console.log('Successfully found job:', {
        id: job.id,
        name: job.name,
        arxenaSiteId: job.arxenaSiteId
      });
      
      return job;
    } catch (error) {
      console.error('Error fetching job details:', error);
      throw new Error(`Failed to fetch job details: ${error.message}`);
    }
  }


  // Helper method to process a chunk of candidates
  async processChunk(
    candidates: UserProfile[],
    jobId: string,
    jobName: any,
    timestamp: any,
    apiToken: any,
    chunkNumber: number,
    totalChunks: any,
  ): Promise<void> {
    console.log(
      `Processing chunk ${chunkNumber}/${totalChunks} with ${candidates.length} candidates`,
    );
    try {
      console.log(
        `Processing mini-chunk of ${candidates.length}  of ${candidates.length})`,
      );
      console.log(
        `Processing mini-chunk unique_key_string of ${candidates.map((x) => x.unique_key_string)})`,
      );
      console.log(
        'Number of unique key strings in the mini-chunk:',
        candidates.map((x) => x.unique_key_string).length,
      );

      // Create a Map to deduplicate candidates by unique_key_string
      const uniqueKeyToProfileMap = new Map<string, UserProfile>();

      // Populate the map with the latest profile for each unique key
      // Skip candidates with empty unique_key_string
      candidates.forEach((candidate) => {
        if (
          candidate &&
          candidate.unique_key_string &&
          candidate.unique_key_string !== ''
        ) {
          uniqueKeyToProfileMap.set(candidate.unique_key_string, candidate);
        }
      });

      // Convert the map values back to an array of UserProfile objects
      const deduplicatedProfiles = Array.from(uniqueKeyToProfileMap.values());

      console.log(
        `Deduplicated and filtered ${candidates.length} candidates to ${deduplicatedProfiles.length} valid unique profiles`,
      );
      console.log(
        `Removed ${candidates.length - deduplicatedProfiles.length} duplicates or empty unique_key_string entries`,
      );

      // Try up to 3 times with exponential backoff
      let success = false;
      let attempt = 0;
      const MAX_ATTEMPTS = 2;

      while (!success && attempt < MAX_ATTEMPTS) {
        try {
          attempt++;
          await this.processProfilesWithRateLimiting(
            deduplicatedProfiles,
            jobId,
            jobName,
            timestamp,
            apiToken,
          );
          success = true;
        } catch (error) {
          console.log('error has been thrown and will do this in another shot');
          if (attempt >= MAX_ATTEMPTS) {
            throw error; // Re-throw on final attempt
          }
          // Exponential backoff delay
          const delay = Math.pow(2, attempt) * 1000;

          console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      // Add delay between GraphQL requests to avoid overloading the API
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(
        `Error processing mini-chunk in chunk ${chunkNumber}:`,
        error,
      );
      // Continue processing other mini-chunks
    }
    // }
  }

  async processProfilesWithRateLimiting(
    data: UserProfile[],
    jobId: string,
    jobName: string,
    timestamp: string,
    apiToken: string,
  ): Promise<{
    manyPersonObjects: ArxenaPersonNode[];
    manyCandidateObjects: ArxenaCandidateNode[];
    allPersonObjects: PersonNode[];
    timestamp: string;
  }> {
    console.log('Queue has begun to be processed. ');
    try {
      const jobObject = await this.getJobDetails(jobId, jobName, apiToken);

      console.log('This is the job:', jobObject);
      if (!jobObject || !jobObject.id) {
        throw new Error(`Job not found or invalid for jobId: ${jobId}, jobName: ${jobName}`);
      }
      const tracking = {
        personIdMap: new Map<string, string>(),
        candidateIdMap: new Map<string, string>(),
      };
      console.log(
        'This is tracking of unique_key_string in processProfilesWithRateLimiting:',
        data.map((x) => x.unique_key_string),
      );
      const results = await this.processBatches(
        data,
        jobObject,
        tracking,
        apiToken,
      );

      return { ...results, timestamp };
    } catch (error) {
      console.error('Error in profile processing:', error);
      throw error;
    }
  }

  private async processPeopleBatch(
    batch: UserProfile[],
    uniqueStringKeys: string[],
    results: any,
    tracking: any,
    apiToken: string,
  ) {
    try {
      console.log('This is tracking in processPeopleBatch:', tracking);

      const personDetailsMap =
        await this.personService.batchGetPersonDetailsByStringKeys(
          uniqueStringKeys,
          apiToken,
        );

      console.log('Person Details Map:', personDetailsMap);
      const peopleToCreate: ArxenaPersonNode[] = [];
      const peopleKeys: string[] = [];

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
          tracking.personIdMap.set(key, personObj?.id);
        }
      }

      console.log('People to create:', peopleToCreate.length);
      if (peopleToCreate.length > 0) {
        const response = await this.personService.createPeople(
          peopleToCreate,
          apiToken,
        );

        response?.data?.data?.createPeople?.forEach((person, idx) => {
          if (person?.id) {
            tracking.personIdMap.set(peopleKeys[idx], person?.id);
          }
        });
      }
    } catch (error) {
      console.log('Error processing people batch1:', error.data);
      console.log('Error processing people batch2:', error.message);
    }
  }

  private async processCandidatesBatch(
    batch: UserProfile[],
    jobObject: Jobs,
    results: any,
    tracking: any,
    apiToken: string,
  ) {
    try {
      console.log('Starting processCandidatesBatch with jobObject:', jobObject);
      
      if (!jobObject) {
        throw new Error('jobObject is undefined in processCandidatesBatch');
      }
      if (!jobObject.id) {
        throw new Error(`jobObject.id is undefined in processCandidatesBatch. jobObject: ${JSON.stringify(jobObject)}`);
      }

      console.log('This is tracking in processCandidatesBatch:', tracking);
  
      const uniqueStringKeys = batch
        .map((p) => p?.unique_key_string)
        .filter(Boolean);
  
      console.log('Checking candidates with keys:', uniqueStringKeys);
      const candidatesMap = await this.batchCheckExistingCandidates(
        uniqueStringKeys,
        jobObject.id,
        apiToken,
      );
  
      console.log('Candidates map:', candidatesMap);
      const workspaceId = await this.getWorkspaceIdFromToken(apiToken);
      console.log('Workspace ID:', workspaceId);
  
      const whatsapp_key = await this.workspaceQueryService.getWorkspaceApiKey(
        workspaceId,
        'whatsapp_key',
      ) || 'whatsapp-web';
      console.log('whatsapp_key:', whatsapp_key);
      
      const candidatesToCreate: ArxenaCandidateNode[] = [];
      const candidateKeys: string[] = [];
      
      const candidatesToUpdate: Array<{
        candidateId: string;
        hiringNaukriUrl: { "primaryLinkLabel": string; "primaryLinkUrl": string; };
        resdexNaukriUrl: { "primaryLinkLabel": string; "primaryLinkUrl": string; };
        displayPicture: { "primaryLinkLabel": string; "primaryLinkUrl": string; };
        linkedinUrl: { "primaryLinkLabel": string; "primaryLinkUrl": string; };
        personId: string;
        profile: UserProfile;
        missingFields: string[];
      }> = [];
  
      for (const profile of batch) {
        const key = profile?.unique_key_string;
  
        if (!key) continue;
  
        const existingCandidate = candidatesMap.get(key);
        const personId = tracking.personIdMap.get(key);
  
        if (personId && !existingCandidate) {
          const { candidateNode } = await processArxCandidate(
            profile,
            jobObject,
            whatsapp_key,
          );
  
          candidateNode.peopleId = personId;
          candidatesToCreate.push(candidateNode);
          candidateKeys.push(key);
          results.manyCandidateObjects.push(candidateNode);
          console.log('Candidate created:', candidateNode);
          
        } else if (existingCandidate) {
          console.log('Existing candidate found:', existingCandidate);
          const missingFields: string[] = [];
          const isFieldEmpty = (field: any): boolean => {
            if (!field) return true;
            if (typeof field === 'string') return field.trim() === '';
            if (typeof field === 'object') {
              if ('primaryPhoneNumber' in field) return !field.primaryPhoneNumber || field.primaryPhoneNumber.trim() === '';
              if ('primaryEmail' in field) return !field.primaryEmail || field.primaryEmail.trim() === '';
              return Object.keys(field).length === 0;
            }
            return false;
          };
          const candidatePhone = existingCandidate?.phoneNumber?.primaryPhoneNumber || existingCandidate?.phoneNumber;
          console.log('Current candidate phone:', candidatePhone);
          const profilePhone = profile?.phone_number || profile?.mobile_phone || profile?.all_numbers?.[0];
          console.log('Profile phone:', profilePhone);
          if (isFieldEmpty(candidatePhone) && profilePhone && profilePhone.trim() !== '') {
            console.log('Adding phoneNumber to missing fields');
            missingFields.push('phoneNumber');
          } else {
            console.log('No phone number to update');
          }
          const profileUrl = profile?.profile_url;
          const candidateEmail = existingCandidate?.email?.primaryEmail || existingCandidate?.email;
          console.log('Current candidate email:', candidateEmail);
          const profileEmail = profile?.email_address?.[0] || profile?.all_mails?.[0];
          console.log('Profile email:', profileEmail);
          if (profileUrl && !profileUrl.includes('naukri')) {
            missingFields.push('profileUrl');
          } else {
            console.log('No profile url to update');
          }
          if (isFieldEmpty(candidateEmail) && profileEmail && profileEmail.trim() !== '') {
            console.log('Adding email to missing fields');
            missingFields.push('email');
          } else {
            console.log('No email to update');
          }

  
          console.log('Missing fields:', missingFields);
          if (missingFields.length > 0) {
            console.log('Missing fields:', missingFields);
            candidatesToUpdate.push({
              candidateId: existingCandidate.id,
              personId: existingCandidate.peopleId || existingCandidate.people?.id,
              hiringNaukriUrl: { "primaryLinkLabel": profile?.profile_url || '', "primaryLinkUrl": profile?.profile_url || '' },
              resdexNaukriUrl: { "primaryLinkLabel": profile?.profile_url || '', "primaryLinkUrl": profile?.profile_url || '' },
              displayPicture: { "primaryLinkLabel": "Display Picture", "primaryLinkUrl": profile?.display_picture || '' },
              linkedinUrl: { "primaryLinkLabel": profile?.profile_url || '', "primaryLinkUrl": profile?.profile_url || '' },
              profile,
              missingFields
            });
          }
  
          tracking.candidateIdMap.set(key, existingCandidate?.id);
        }
      }
  
      console.log('Candidates to create:', candidatesToCreate.length);
      console.log('Candidates to update:', candidatesToUpdate.length);
      console.log('Candidates candidateKeys:', candidateKeys);
      console.log('tracking.candidateIdMap:', tracking.candidateIdMap);
  
      if (candidatesToCreate.length > 0) {
        const response = await this.createCandidates(
          candidatesToCreate,
          apiToken,
        );
  
        console.log('Create candidates response:', response?.data);
        response?.data?.data?.createCandidates?.forEach(
          (candidate: { id: any }, idx: string | number) => {
            if (candidate?.id) {
              tracking.candidateIdMap.set(candidateKeys[idx], candidate.id);
            }
          },
        );
      }
  
      console.log("Number of candidates to update:", candidatesToUpdate.length);
      if (candidatesToUpdate.length > 0) {
        console.log('Updating existing candidates with missing fields...');
        
        for (const updateCandidate of candidatesToUpdate) {
          const { candidateId, personId, profile, missingFields } = updateCandidate;
          
          try {
            for (const fieldName of missingFields) {
              if (fieldName === 'phoneNumber') {
                const phoneValue = profile?.phone_number || 
                                 profile?.mobile_phone || 
                                 profile?.all_numbers?.[0] || '';
                
                if (phoneValue && phoneValue.trim() !== '') {
                  console.log(`Updating phone number for candidate ${candidateId} with value: ${phoneValue}`);
                  await this.handlePhoneNumberUpdate(candidateId, phoneValue, apiToken);
                }
              } else if (fieldName === 'email') {
                const emailValue = profile?.email_address?.[0] || 
                                 profile?.all_mails?.[0] || '';
                
                if (emailValue && emailValue.trim() !== '') {
                  console.log(`Updating email for candidate ${candidateId} with value: ${emailValue}`);
                  
                  const updateData = {"email": {primaryEmail: emailValue}};
                  await axiosRequest(
                    JSON.stringify({ 
                      query: graphQltoUpdateOneCandidate, 
                      variables: { 
                        idToUpdate: candidateId, 
                        input: updateData 
                      } 
                    }),
                    apiToken
                  );
                  
                  if (personId) {
                    const response = await axiosRequest(
                      JSON.stringify({ 
                        query: mutationToUpdateOnePerson, 
                        variables: {
                          idToUpdate: personId, 
                          input: {emails: {primaryEmail: emailValue}}
                        }
                      }),
                      apiToken
                    );
                    console.log("Email update response:", response?.data?.data);
                  }
                }
              }
            }
          } catch (error) {
            console.log(`Error updating candidate ${candidateId}:`, error);
          }
        }
      }
    } catch (error) {
      console.log('Error processing candidates batch:1', error.data);
      console.log('Error processing candidates batch:2', error);
      console.log('Error processing candidates batch:3', error?.response?.data);
      console.log('Error processing candidates batch:4', error.message);
    }
  }

  async createCandidates(
    manyCandidateObjects: ArxenaCandidateNode[],
    apiToken: string,
  ): Promise<any> {
    console.log('Creating candidates, count:', manyCandidateObjects?.length);
    console.log('This is the manyCandidateObjects:', manyCandidateObjects);
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

  async getFieldMetadataFromId(
    fieldMetadataId: string,
    allDataObjects: any,
  ): Promise<{ objectType: string; fieldName: string } | null> {
    // Search through all objects and their fields to find the matching field metadata
    for (const edge of allDataObjects.objects.edges) {
      const fieldEdge = edge.node.fields.edges.find(
        (fieldEdge: any) => fieldEdge.node.id === fieldMetadataId,
      );

      if (fieldEdge) {
        return {
          objectType: edge.node.nameSingular,
          fieldName: fieldEdge.node.name,
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
        return (
          Array.isArray(filterValue) &&
          filterValue.some((v) => String(v).toLowerCase() === stringValue)
        );
      case 'notIn':
        return (
          Array.isArray(filterValue) &&
          !filterValue.some((v) => String(v).toLowerCase() === stringValue)
        );
      default:
        return true;
    }
  }

  async getFieldValueFromCandidate(
    candidate: any,
    fieldMetadataId: string,
    allDataObjects: any,
  ): Promise<any> {
    const fieldMetadata = await this.getFieldMetadataFromId(
      fieldMetadataId,
      allDataObjects,
    );

    if (!fieldMetadata) return null;

    switch (fieldMetadata.objectType) {
      case 'groupHrHeadJobCandidate':
        return candidate[fieldMetadata.fieldName];
      case 'person':
        return candidate.people?.[fieldMetadata.fieldName];
      default:
        return candidate[fieldMetadata.fieldName];
    }
  }


  getIconForFieldType = (fieldType: string): string => {
    const iconMap: Record<string, string> = {
      Number: 'IconNumbers',
      Text: 'IconAbc',
      Boolean: 'IconToggleRight',
      DateTime: 'IconCalendar',
      Select: 'IconSelect',
      Link: 'IconLink',
      RawJson: 'IconJson',
    };

    return iconMap[fieldType] || 'IconAbc';
  };

  private createFieldDefinition(
    fieldName: string,
    objectMetadataId: string,
  ): any {
    const fieldType = this.determineFieldType(fieldName);
    const fieldsCreator = new CreateFieldsOnObject();
    const icon = fieldType === 'Number' ? 'IconNumbers' : 'IconAbc';

    const methodName = `create${fieldType}`;

    if (!(methodName in fieldsCreator)) {
      console.warn(
        `Method ${methodName} not found in CreateFieldsOnObject, defaulting to TextField`,
      );

      return fieldsCreator.createTextField({
        label: this.formatFieldLabel(fieldName),
        name: fieldName,
        objectMetadataId: objectMetadataId,
        description: this.formatFieldLabel(fieldName),
        icon: this.getIconForFieldType(fieldType),
      });
    }

    try {
      return fieldsCreator[methodName]({
        label: this.formatFieldLabel(fieldName),
        name: fieldName,
        objectMetadataId: objectMetadataId,
        description: this.formatFieldLabel(fieldName),
      });
    } catch (error) {
      console.error(
        `Error creating field ${fieldName} of type ${fieldType}:`,
        error,
      );

      return fieldsCreator.createTextField({
        label: this.formatFieldLabel(fieldName),
        name: fieldName,
        objectMetadataId: objectMetadataId,
        description: this.formatFieldLabel(fieldName),
      });
    }
  }

  private determineFieldType(fieldName: string): string {
    if (
      fieldName.includes('year') ||
      fieldName.includes('months') ||
      fieldName.includes('lacs') ||
      fieldName.includes('thousands') ||
      fieldName.includes('experienceYears') ||
      fieldName.includes('experienceMonths') ||
      fieldName.includes('ugGraduationYear') ||
      fieldName.includes('pgGraduationYear') ||
      fieldName.includes('age') ||
      fieldName.includes('inferredSalary')
    ) {
      return 'NumberField';
    }
    if (
      fieldName.includes('link') ||
      fieldName.includes('profileUrl') ||
      fieldName.includes('displayPicture')
    ) {
      return 'LinkField';
    }
    if (fieldName.includes('lastUpdated') || fieldName.includes('lastActive')) {
      return 'DateTimeField';
    }
    if (
      fieldName.includes('multi') ||
      fieldName.includes('skills') ||
      fieldName.includes('locations')
    ) {
      return 'SelectField';
    }
    return 'TextField';
  }


  private formatFieldLabel(fieldName: string): string {
    return fieldName
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .trim();
  }

  /**
   * Updates a field value for a candidate
   */
  async updateCandidateFieldValue(
    candidateId: string,
    fieldName: string,
    value: any,
    apiToken: string,
  ): Promise<any> {
    try {
      console.log("Going to update fieldName:", fieldName)
      const workspaceId = await this.getWorkspaceIdFromToken(apiToken);
      
      // Initialize candidate fields for this workspace if not already loaded
      await this.initializeCandidateFields(workspaceId, apiToken);
      
      // Get the workspace fields map
      const workspaceFieldsMap = this.candidateFieldsMap.get(workspaceId) || new Map();
      
      // Try to find the field directly
      let fieldInfo = workspaceFieldsMap.get(fieldName);
      
      // If not found, try various transformations of the field name
      if (!fieldInfo) {
        // Try snake_case (convert camelCase to snake_case)
        const snakeCaseName = fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
        fieldInfo = workspaceFieldsMap.get(snakeCaseName);
        
        // If still not found, check if any workspace field name is contained within the fieldName
        if (!fieldInfo) {
          console.log('Field not directly found, checking similar names...');
          for (const [key, value] of workspaceFieldsMap.entries()) {
            // Check if the field name contains the workspace field key
            if (fieldName.toLowerCase().includes(key.toLowerCase())) {
              console.log(`Found potential match: ${key} for ${fieldName}`);
              fieldInfo = value;
              break;
            }
          }
        }
      }
      
      if (!fieldInfo || !fieldInfo.id) {
        console.error(`Field ${fieldName} not found in workspace fields`);
        
        // As a fallback, create the field if it doesn't exist
        console.log(`Creating new field: ${fieldName}`);
        const createFieldQuery = createOneCandidateField;
        const fieldVariables = {
          input: {
            name: fieldName,
            candidateFieldType: 'Text', // Default to Text type
          }
        };

        try {
          const response = await axiosRequest(
            JSON.stringify({ query: createFieldQuery, variables: fieldVariables }),
            apiToken
          );
          
          if (response?.data?.data?.createCandidateField?.id) {
            fieldInfo = {
              id: response.data.data.createCandidateField.id,
              name: fieldName
            };
            
            // Update the map
            workspaceFieldsMap.set(fieldName, fieldInfo);
            this.candidateFieldsMap.set(workspaceId, workspaceFieldsMap);
            
            console.log(`Successfully created field: ${fieldName} (ID: ${fieldInfo.id})`);
          } else {
            throw new Error(`Failed to create field ${fieldName}`);
          }
        } catch (error) {
          console.error(`Error creating field ${fieldName}:`, error);
          throw error;
        }
      }
      
      // Special handling for mobile_phone field
      if (fieldName === 'mobilePhone') {
        console.log("Going to update mobilePhone in person and candidate")
        return this.handlePhoneNumberUpdate(candidateId, value, apiToken);
      }
      

      const findVariables = {
        where: {
          candidateFieldsId: { eq: fieldInfo.id },
          candidateId: { eq: candidateId }
        }
      };
      
      const findResponse = await axiosRequest(
        JSON.stringify({ query: graphqlToFindManyCandidateFieldValues, variables: findVariables }),
        apiToken
      );
      
      const existingFieldValues = findResponse?.data?.data?.candidateFieldValues?.edges || [];
      
      if (existingFieldValues.length > 0) {
        // Update existing field value using a simple GraphQL mutation
        
        const fieldValueId = existingFieldValues[0]?.node?.id;
        
        const updateVariables = {
          id: fieldValueId,
          data: { name: String(value) }
        };
        
        const updateResponse = await axiosRequest(
          JSON.stringify({ query: updateCandidateFieldValueMutation, variables: updateVariables }),
          apiToken
        );
        
        return updateResponse?.data?.data?.updateCandidateFieldValue;
      } else {
        // Create new field value
        const createMutation = graphqlQueryToCreateOneCandidateFieldValue;
        
        const createVariables = {
          input: {
            name: String(value),
            candidateFieldsId: fieldInfo.id,
            candidateId: candidateId
          }
        };
        
        const createResponse = await axiosRequest(
          JSON.stringify({ query: createMutation, variables: createVariables }),
          apiToken
        );
        
        return createResponse?.data?.data?.createCandidateFieldValue;
      }
    } catch (error) {
      console.error('Error updating candidate field value:', error);
      throw error;
    }
  }




  async handlePhoneNumberUpdate(candidateId: string, value: string, apiToken: string): Promise<any> {

      try {
        // Get the candidate to find the associated person
        
        const graphqlQueryObj = JSON.stringify({
          query: graphqlToFetchAllCandidateData,
          variables: { filter: { id: { eq: candidateId } } },
        });
        const candidateResponse = await axiosRequest(graphqlQueryObj, apiToken);
  
        console.log("candidateResponse:", candidateResponse.data.data)
        const personId = candidateResponse?.data?.data?.candidates?.edges[0]?.node?.peopleId;
        console.log("personId:", personId)
        if (personId) {
          // Update person's phoneNumber field
          
          await axiosRequest(
            JSON.stringify({ 
              query: mutationToUpdateOnePerson, 
              variables: {
                idToUpdate: personId, 
                input: { phones: { primaryPhoneNumber: String(value) } }
              } 
            }),
            apiToken
          );
          console.log("person updated")
        }
        console.log("this is the value of string value of phone number:", String(value))
        await axiosRequest(
          JSON.stringify({ 
            query: graphQltoUpdateOneCandidate, 
            variables: { 
              idToUpdate: candidateId, 
              input: { phoneNumber: { primaryPhoneNumber: String(value) } } 
            } 
          }),
          apiToken
        );
        console.log("candidate updated")
        
        console.log(`Updated phoneNumber for candidate ${candidateId} and person ${personId}`);
      } catch (error) {
        console.error('Error updating phoneNumber fields:', error);
        // Continue with the regular field value update even if this fails
      }

    }
  /**
   * Updates a direct field on a candidate
   */
  async updateCandidateField(
    personId: string,
    candidateId: string,
    fieldName: string,
    value: any,
    apiToken: string,
    origin: string,
  ): Promise<any> {
    try {
      // Format the value based on field type
      let formattedValue = value;
      console.log("formattedValue::", formattedValue)
      // Convert boolean strings to actual booleans
      if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
        formattedValue = value.toLowerCase() === 'true';
      }
      
      let updateData: Record<string, any> = {};
      updateData[fieldName] = formattedValue;
      
      if (fieldName === 'email') {
        updateData = {"email":{primaryEmail: formattedValue}}
        const response = await axiosRequest(
          JSON.stringify({ query: mutationToUpdateOnePerson, variables: {idToUpdate: personId, input: {emails: {primaryEmail: formattedValue}}} }),
          apiToken
        );
        console.log("response::", response?.data?.data)
      }

      if (fieldName === 'mobilePhone' || fieldName === 'phone' || fieldName === 'phoneNumber') {
        updateData = {"phoneNumber":{primaryPhoneNumber: formattedValue}};
        
        // Get the old phone number before updating
        const candidateResponse = await axiosRequest(
          JSON.stringify({ 
            query: graphqlToFetchAllCandidateData, 
            variables: { 
              filter: { id: { eq: candidateId } } 
            } 
          }),
          apiToken,
        );
        const oldPhoneNumber = candidateResponse?.data?.data?.candidates?.edges[0]?.node?.phoneNumber?.primaryPhoneNumber;
        console.log("candidateResponse::", candidateResponse?.data?.data.candidates.edges[0].node)
        console.log("oldPhoneNumber::", oldPhoneNumber)
        console.log("formattedValue::", formattedValue)
        // Update person's phone number
        const response = await axiosRequest(
          JSON.stringify({ 
            query: mutationToUpdateOnePerson, 
            variables: {
              idToUpdate: personId, 
              input: {
                phones: {
                  primaryPhoneNumber: formattedValue
                }
              }
            } 
          }),
          apiToken,
        );

        if (oldPhoneNumber !== formattedValue) {
          try {
            console.log("Going to get recruiter profile from current user in updateCandidateField");
            const recruiterProfile = await getRecruiterProfileFromCurrentUser(apiToken, origin);
            const userId = recruiterProfile?.id;
            console.log("userId::", userId)
            if (!userId) {
              console.error('Could not get userId from recruiter profile');
              throw new Error('Could not get userId from recruiter profile');
            }

            console.log('Debug - Current environment:', {
              NODE_ENV: process.env.NODE_ENV,
              SERVER_BASE_URL: process.env.SERVER_BASE_URL,
              origin: origin
            });
            const url = process.env.SERVER_BASE_URL + '/ext-sock-whatsapp/update-whitelist';
            if (!oldPhoneNumber) {
              console.warn('No old phone number provided for whitelist update');
            }
            const formatPhoneForRequest = (number: string) => {
              if (!number) return '';
              const digits = number.replace(/\D/g, '');
              return digits.length === 10 ? `91${digits}` : digits;
            };

            const payload = {
              oldPhoneNumber: formatPhoneForRequest(oldPhoneNumber),
              newPhoneNumber: formatPhoneForRequest(formattedValue),
              userId: userId,
            };
            
            console.log('Debug - Attempting whitelist update:', {
              url,
              payload
            });

            const response = await axios.post( url, payload, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiToken}`, }, } );
            console.log('Debug - Whitelist update response:', {
              status: response.status,
              data: response.data
            });
            
          } catch (error) {
            // Enhanced error logging
            console.error('Debug - Whitelist update error:', {
              message: error.message,
              status: error.response?.status,
              data: error.response?.data,
              code: error.code,
              url: process.env.SERVER_BASE_URL + '/ext-sock-whatsapp/update-whitelist',
              headers: error.response?.headers
            });
            
            // Don't throw - we want to continue with the update even if whitelist fails
            console.log('Continuing with update despite whitelist error');
          }
        }
      }


      console.log("updateData::", updateData)
      const variables = {
        idToUpdate: candidateId,
        input: updateData
      };
      console.log("variables::", variables)
      const response = await axiosRequest(
        JSON.stringify({ query: graphQltoUpdateOneCandidate, variables }),
        apiToken
      );
      console.log("response::", response?.data?.data)
      return response?.data?.data;
    } catch (error) {
      console.error('Error updating candidate field:', error);
      throw error;
    }
  }
  async getCandidateFieldsByJobId(
    jobId: string,
    apiToken: string,
  ): Promise<any> {
    try {
      const variables = {
        filter: { id: { eq: jobId } },
        orderBy: [{ position: 'AscNullsFirst' }],
        limit: 100
      };

      const query = graphqlToFindManyJobs;
      
      const response = await axiosRequest(
        JSON.stringify({ query, variables }),
        apiToken
      );
      console.log('This is the response:', response.data.data?.jobs?.edges[0]?.node?.candidates?.edges[0]?.node?.candidateFieldValues?.edges.map((edge: any) => edge.node.candidateFields.name));
      const candidateFieldsJobs = response?.data?.data?.jobs?.edges[0]?.node?.candidateFields?.edges || [];
      const candidateFields = response.data.data?.jobs?.edges[0]?.node?.candidates?.edges[0]?.node?.candidateFieldValues?.edges.map((edge: any) => edge.node.candidateFields.name) || [];
      return candidateFields;
    } catch (error) {
      console.error('Error fetching candidate fields by job ID:', error);
      throw error;
    }
  }
}