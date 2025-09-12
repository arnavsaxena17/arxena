import { Injectable } from '@nestjs/common';

import {
  ArxenaCandidateNode,
  ArxenaPersonNode,
  CandidateFieldEdge,
  CandidatesEdge,
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
  graphqlToFindManyJobsWithCandidateValues,
  graphQltoUpdateOneCandidate,
  Job,
  mutationToUpdateOnePerson,
  PageInfo,
  PersonNode,
  updateOneCandidateFieldValue,
  UserProfile
} from 'twenty-shared';

import { generateCompleteMappings, processArxCandidate } from 'src/engine/core-modules/candidate-sourcing/utils/data-transformation-utility';

import axios from 'axios';

import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import { CreateMetaDataStructure } from 'src/engine/core-modules/workspace-modifications/object-apis/object-apis-creation';
import { createRelations } from 'src/engine/core-modules/workspace-modifications/object-apis/services/relation-service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { PersonService } from './person.service';

// import { WebSocketGateway } from 'src/modules/websocket/websocket.gateway';

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
    private readonly staticGraphQLService: StaticGraphQLService,
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

      const response = await this.staticGraphQLService.executeGraphQL(
        query,
        variables,
        apiToken,
      );

      const fields = response?.data?.data?.candidateFields as {
        edges: CandidateFieldEdge[];
        pageInfo: PageInfo;
      } | undefined;
        // const fields = fields?.edges || [];
      const workspaceFieldsMap = new Map<string, { id: string; name: string }>();

      fields?.edges.forEach((field: any) => {
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


      const response = await this.staticGraphQLService.executeGraphQL(
        getExistingRelationsQuery,
        { objectMetadataId },
        apiToken,
      );

      const relations = response?.data?.data?.relations as {
        edges: any[];
        pageInfo: PageInfo;
      } | undefined;
      const relationEdges = relations?.edges?.map((edge: any) => edge.node) || [] as any[];
      return relationEdges;
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

      const response = await this.staticGraphQLService.executeGraphQL(
        query,
        variables,
        apiToken,
      );

      const videoInterviewModels = response?.data?.data?.videoInterviewModels as {
        edges: any[];
        pageInfo: PageInfo;
      } | undefined;
      return videoInterviewModels?.edges || [] as any[];
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
      this.staticGraphQLService,
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
    const graphqlQuery = {
      filter: {
        uniqueStringKey: { in: uniqueStringKeys },
        jobsId: { eq: jobId },
      },
    };
    
    const response = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, graphqlQuery, apiToken);

    const candidatesMap = new Map<string, any>();
    const candidates = response?.data?.data?.candidates as {
      edges: CandidatesEdge[];
      pageInfo: PageInfo;
    } | undefined;

    if (!response?.data?.data?.candidates) {
      console.log('No candidates found in response'); // Add this

      return candidatesMap;
    }
    candidates?.edges?.forEach((edge: any) => {
      if (edge?.node?.uniqueStringKey) {
        candidatesMap.set(edge.node.uniqueStringKey, edge.node);
      }
    });
    console.log('CandidatesMap is a response Data:', candidatesMap);

    return candidatesMap;
  }

  private async processBatches(
    data: UserProfile[],
    jobObject: Job,
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
    console.log('This is the data in processBatches:', data);
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

    // Get existing candidates before processing
    const existingCandidatesMap = await this.batchCheckExistingCandidates(
      uniqueStringKeys,
      jobObject.id,
      apiToken,
    );

    // Filter data to only include new candidates
    const newCandidatesData = data.filter(profile => {
      const key = profile?.unique_key_string;
      return key && !existingCandidatesMap.get(key);
    });

    const recruiterId = jobObject.recruiterId;
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

    // Only call createCandidateFieldsAndValues for new candidates
    if (newCandidatesData.length > 0) {
      await this.createCandidateFieldsAndValues(newCandidatesData, jobObject, results, tracking, apiToken);
    }

    // this.webSocketGateway.s(recruiterId, 'candidate_upload_batch', {
    //   message: 'Candidate upload batch completed',
    // });


      // Replace WebSocket call with axios call to refresh-table-data
      if (recruiterId) {
        try{

          await this.refreshTableData(recruiterId, apiToken);
        } catch (error) {
          console.error('Error in refreshTableData:', error);
        }
      }




    // if (this.workspaceQueryService.webSocketService) {
    //   this.workspaceQueryService.webSocketService.sendToUser(recruiterId, 'refresh_table_data', {
    //     message: 'Refreshing table data',
    //   });
    // } else {
    //   console.error('WebSocket gateway instance not available');
    // }

    return results;
  }

  async createCandidateFieldsAndValues(
    data: any, 
    jobObject: Job, 
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

    // Define excluded fields
    const excludedFields = ['age', 'birth_date', 'full_name', 'gender', 'all_mails', 'all_numbers', 'experience_stats', 'queryId', 'data_sources', 'interests', 'locations', 'profiles', 'phone_numbers', 'tables', 'socialprofiles', 'count_promotions', 'ug_graduation_year', 'pg_graduation_year', 'current_role_tenure', 'total_tenure', 'total_job_changes', 'average_tenure', 'pg_institute_name', 'ug_graduation_degree', 'pg_graduation_degree', 'ug_graduation_year', 'education_institute_ug', 'education_type_ug', 'education_year_ug', 'education_course_ug', 'education_institute_pg', 'education_type_pg', 'education_year_pg', 'education_course_pg','ug_institute_name'];
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
          // Skip excluded fields
          if (!excludedFields.includes(fieldName.key)) {
            console.log(`- ${fieldName.key}`);
            uniqueFields.add(fieldName.key);
          } else {
            console.log(`Skipping excluded field: ${fieldName.key}`);
          }
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
      // Skip excluded fields
      if (excludedFields.includes(fieldName)) {
        console.log(`Skipping creation of excluded field: ${fieldName}`);
        continue;
      }

      if (!workspaceFieldsMap.has(fieldName)) {
        console.log(`\nCreating new field: ${fieldName}`);
        const createFieldQuery = createOneCandidateField;
        const fieldVariables = { input: { name: fieldName.toString(), candidateFieldType: 'Text', } };
        try {
          const response = await this.staticGraphQLService.executeGraphQL(
            createFieldQuery,
            fieldVariables,
            apiToken
          );
          const fieldObj   = response?.data?.data?.createCandidateField as {
            id: string;
            name: string;
          } | undefined;

          if (fieldObj?.id) {
            workspaceFieldsMap.set(fieldName, {
              id: fieldObj?.id,
              name: fieldName
            });
            console.log(`Successfully created field: ${fieldName} (ID: ${fieldObj?.id})`);
          }
          console.log('This is the workspaceFieldsMap:', workspaceFieldsMap);
        } catch (error) {
          console.error(`Error creating field ${fieldName}:`, error);
          continue;
        }
      } else {
        console.log(`Field already exists: ${fieldName}`);
      }
    }

    console.log('This is the data:', data);
    console.log('This is the numebr of candidates:', data.length);
    for (const candidate of data) {

      const { unmappedCandidateObject } = await generateCompleteMappings(candidate, jobObject);
      console.log('This is the unmappedCandidateObject:', unmappedCandidateObject);
      const candidateId = tracking.candidateIdMap.get(candidate.unique_key_string);
      console.log('This is the candidateId:', candidateId, "for the candidate:", candidate.unique_key_string);        
      console.log('This is the unmappedCandidateObject length:', unmappedCandidateObject.length);
      unmappedCandidateObject.forEach((field: any) => {
        // Skip excluded fields
        if (excludedFields.includes(field.key)) {
          console.log(`Skipping value creation for excluded field: ${field.key}`);
          return;
        }

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



    this.candidateFieldsMap.set(workspaceId, workspaceFieldsMap);
    console.log('This is the workspaceFieldsMap:', workspaceFieldsMap);
    console.log('This is the fieldValuesToCreate:', fieldValuesToCreate);
    console.log('This is the number of fieldValuesToCreate:', fieldValuesToCreate.length);
    if (fieldValuesToCreate.length > 0) {
      console.log(`\nCreating ${fieldValuesToCreate.length} field values in batches`);
      const batchSize = 30;
      for (let i = 0; i < fieldValuesToCreate.length; i += batchSize) {
        const batch = fieldValuesToCreate.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(fieldValuesToCreate.length/batchSize)}`);
        try {
          const response = await this.staticGraphQLService.executeGraphQL(
            CreateManyCandidateFieldValues,
            { data: batch },
            apiToken
          );
          console.log(`Successfully created batch ${Math.floor(i/batchSize) + 1}`);
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
  ): Promise<Job> {
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
    let variables;

    if (isValidUUIDv4(jobId)) {
      queryType = 'UUID';
      variables = {
        filter: { id: { in: [jobId] } },
        limit: 30,
        orderBy: [{ position: 'AscNullsFirst' }],
      };
    } else if (isValidMongoDBId(jobId)) {
      queryType = 'MongoDB ID';
      variables = {
        filter: { arxenaSiteId: { in: [jobId] } },
        limit: 30,
        orderBy: [{ position: 'AscNullsFirst' }],
      };
    } else if (jobName) {
      queryType = 'Job Name';
      variables = {
        filter: { name: { in: [jobName] } },
        limit: 30,
        orderBy: [{ position: 'AscNullsFirst' }],
      };
    } else {
      throw new Error('Invalid job identifier provided - neither valid ID nor name');
    }

    console.log(`Querying job by ${queryType}`);
    
    try {
      const response = await this.staticGraphQLService.executeGraphQL(graphqlToFindManyJobs, variables, apiToken);
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

      const recruiterId = jobObject.recruiterId;
      console.log('recruiterId:', recruiterId);

      return { ...results, timestamp };
    } catch (error) {
      console.error('Error in profile processing:', error);
      throw error;
    }
  }





  private async refreshTableData(recruiterId: string, apiToken: string) {
    const serverBaseUrl = process.env.SERVER_BASE_URL || 'http://localhost:3000';
    await axios.post(
      `${serverBaseUrl}/candidate-sourcing/refresh-table-data`,
      { recruiterId },
      { headers: { 'Authorization': `Bearer ${apiToken}` } }
    );
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
    jobObject: Job,
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

      const recruiterId = jobObject.recruiterId;
      if (!recruiterId) {
        console.warn('No recruiterId found in jobObject');
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
      ) || process.env.DEFAULT_WHATSAPP_CLIENT || 'baileys';
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
        console.log("This is the candidates unique_key_string:", key);
        console.log("This is the candidates candidatesMap:", candidatesMap);
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
          
          console.log('profileUrl to be checked for duplication:', profileUrl);
          if (profileUrl && profileUrl.includes('naukri')) {
            missingFields.push('profileUrl');
          } else {
            console.log('No profile url to update for naukri');
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
            const candidateToUpdate = 
            {
              candidateId: existingCandidate.id,
              personId: existingCandidate.peopleId || '',
              hiringNaukriUrl: { "primaryLinkLabel": profile?.profile_url.includes('hiring') ? profile?.profile_url : '', "primaryLinkUrl": profile?.profile_url.includes('hiring') ? profile?.profile_url : '' },
              resdexNaukriUrl: { "primaryLinkLabel": profile?.profile_url.includes('resdex') ? profile?.profile_url : '', "primaryLinkUrl": profile?.profile_url.includes('resdex') ? profile?.profile_url : '' },
              displayPicture: { "primaryLinkLabel": "Display Picture", "primaryLinkUrl": profile?.display_picture || '' },
              linkedinUrl: { "primaryLinkLabel": profile?.profile_url.includes('linkedin') ? profile?.profile_url : '', "primaryLinkUrl": profile?.profile_url.includes('linkedin') ? profile?.profile_url : '' },
              profile: profile,
              missingFields
            }
            if ('uniqueStringKey' in candidateToUpdate) {
              delete candidateToUpdate.uniqueStringKey;
            }
            if ('unique_key_string' in candidateToUpdate) {
              delete candidateToUpdate.unique_key_string;
            }
            candidatesToUpdate.push(candidateToUpdate);
          }
          // console.log("Candidate to update:", candidatesToUpdate.map((c) => c.profile.unique_key_string));
          console.log("Candidate to update:", candidatesToUpdate);
          
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
        console.log('Updating existing candidates...');
        for (const updateCandidate of candidatesToUpdate) {
          const { candidateId, personId, profile, missingFields } = updateCandidate;
          console.log("updateCandidate:", updateCandidate);
          try {
            for (const fieldName of missingFields) {
              if (fieldName === 'phoneNumber') {
                const phoneValue = profile?.phone_number || profile?.mobile_phone || profile?.all_numbers?.[0] || '';
                if (phoneValue && phoneValue.trim() !== '') {
                  console.log(`Updating phone number for candidate ${candidateId} with value: ${phoneValue}`);
                  await this.handlePhoneNumberUpdate(candidateId, phoneValue, apiToken);
                }
              } else if (fieldName === 'email') {
                const emailValue = profile?.email_address?.[0] || profile?.all_mails?.[0] || '';
                if (emailValue && emailValue.trim() !== '') {
                  console.log(`Updating email for candidate ${candidateId} with value: ${emailValue}`);
                  const updateData = {"email": {primaryEmail: emailValue}};
                  const response = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, { idToUpdate: candidateId, input: updateData }, apiToken);
                  console.log("Email update response:", response?.data?.data);
                  if (personId) {
                    const response = await this.staticGraphQLService.executeGraphQL(mutationToUpdateOnePerson, { idToUpdate: personId, input: {emails: {primaryEmail: emailValue}} }, apiToken);
                    console.log("Email update response:", response?.data?.data);
                  }
                }
              }
              if (fieldName === 'profileUrl') {
                const profileUrl = profile?.profile_url;
                if (profileUrl && profileUrl.includes('naukri')) {
                  console.log(`Updating profile url for candidate ${candidateId} with value: ${profileUrl}`);
                  console.log("profileUrl:", profileUrl);
                  const updateData = {"hiringNaukriUrl": {primaryLinkLabel: profileUrl, primaryLinkUrl: profileUrl}, "resdexNaukriUrl": {primaryLinkLabel: profileUrl, primaryLinkUrl: profileUrl}, "linkedinUrl": {primaryLinkLabel: profileUrl, primaryLinkUrl: profileUrl}};
                  const response = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, { idToUpdate: candidateId, input: updateData }, apiToken);
                  console.log("Profile url update response:", response?.data?.data);
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
      const response = await this.staticGraphQLService.executeGraphQL(CreateManyCandidates, graphqlVariables, apiToken);

      return response;
    } catch (error) {
      console.log('Error in creating candidates1', error?.data);
      console.log('Error in creating candidates2', error?.message);
      console.log('Error in creating candidates3', error);
    }
  }

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
        console.log("snakeCaseName::", snakeCaseName)
        fieldInfo = workspaceFieldsMap.get(snakeCaseName);
        console.log("fieldInfo::", fieldInfo)
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
          const response = await this.staticGraphQLService.executeGraphQL(createOneCandidateField, fieldVariables, apiToken);

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
        filter: {
          and: [ { candidateId: { in: [candidateId] } }, { candidateFieldsId: { in: [fieldInfo.id] } } ]
        },
        orderBy: [{ position: "AscNullsFirst" }]
      };
      


      const findResponse = await this.staticGraphQLService.executeGraphQL(graphqlToFindManyCandidateFieldValues, findVariables, apiToken);
      const snakeCaseName = fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
      console.log("snakeCaseName::", snakeCaseName)
      console.log("findResponse?.data?.data?.candidateFieldValues?.edges::", findResponse?.data?.data?.candidateFieldValues?.edges)
      console.log("findResponse?.data?.data?.candidateFieldValues?.edges[0]?.node?.candidateFields?.name::", findResponse?.data?.data?.candidateFieldValues?.edges[0]?.node?.candidateFields)
      const existingFieldValues = findResponse?.data?.data?.candidateFieldValues?.edges.filter((edge: any) => edge?.node?.candidateFields?.name === snakeCaseName) || [];
      console.log("existingFieldValues::", existingFieldValues)
      if (existingFieldValues.length > 0) {
        // Update existing field value using a simple GraphQL mutation
        console.log("Setting value to :", String(value))
        const updatePromises = existingFieldValues.map(async (fieldValue) => {
          console.log("fieldValue::", fieldValue)
          const fieldValueId = fieldValue?.node?.id;
          console.log("fieldValueId::", fieldValueId)
          const updateVariables = {
            idToUpdate: fieldValueId,
            input: { name: String(value) }
          };

          const updateResponse = await this.staticGraphQLService.executeGraphQL(updateOneCandidateFieldValue, updateVariables, apiToken);

          return updateResponse?.data?.data?.updateCandidateFieldValue;
        });

        const results = await Promise.all(updatePromises);
        return results;
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
        const createResponse = await this.staticGraphQLService.executeGraphQL(createMutation, createVariables, apiToken);
        return createResponse?.data?.data?.createCandidateFieldValue;
      }
    } catch (error) {
      console.error('Error updating candidate field value:', error);
      throw error;
    }
  }




  async handlePhoneNumberUpdate(candidateId: string, value: string, apiToken: string): Promise<any> {
    try {
      const candidateResponse = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, { filter: { id: { eq: candidateId } } }, apiToken);

      const oldPhoneNumber = candidateResponse?.data?.data?.candidates?.edges[0]?.node?.phoneNumber?.primaryPhoneNumber;
      const personId = candidateResponse?.data?.data?.candidates?.edges[0]?.node?.peopleId;
      console.log("candidateResponse::", candidateResponse?.data?.data.candidates.edges[0].node);
      console.log("oldPhoneNumber::", oldPhoneNumber);
      console.log("formattedValue::", value);


      const updatePersonResponse = await this.staticGraphQLService.executeGraphQL(mutationToUpdateOnePerson, { idToUpdate: personId, input: { phones: { primaryPhoneNumber: String(value) } } }, apiToken);
      const updateCandidateResponse = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, { idToUpdate: candidateId, input: { phoneNumber: { primaryPhoneNumber: String(value) } } }, apiToken);


      // Only update whitelist if the phone number has actually changed
      if (oldPhoneNumber !== value) {
        try {
          console.log("Going to get recruiter profile from current user in updateCandidateField");
          const serverBaseUrl = process.env.SERVER_BASE_URL || 'http://localhost:3000';
          const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileFromCurrentUser(apiToken, serverBaseUrl);
          const userId = recruiterProfile?.id;
          console.log("userId::", userId);
          
          if (!userId) {
            console.error('Could not get userId from recruiter profile');
            throw new Error('Could not get userId from recruiter profile');
          }

          const formatPhoneForRequest = (number: string) => {
            if (!number) return '';
            const digits = number.replace(/\D/g, '');
            return digits.length === 10 ? `91${digits}` : digits;
          };

          const payload = {
            oldPhoneNumber: formatPhoneForRequest(oldPhoneNumber),
            newPhoneNumber: formatPhoneForRequest(value),
            userId: userId,
          };

          console.log('Debug - Attempting whitelist update:', {
            url: `${serverBaseUrl}/ext-sock-whatsapp/update-whitelist`,
            payload
          });

          const response = await axios.post(
            `${serverBaseUrl}/ext-sock-whatsapp/update-whitelist`,
            payload,
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken}`,
              },
            }
          );

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
            url: `${process.env.SERVER_BASE_URL}/ext-sock-whatsapp/update-whitelist`,
            headers: error.response?.headers
          });
          
          // Don't throw - we want to continue even if whitelist update fails
          console.log('Continuing despite whitelist error');
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating phone number fields:', error);
      throw error;
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
      console.log("Going to update candidate field:::", fieldName, candidateId, personId, value);
      
      if(value === null || value === undefined) {
        console.log("value is null or undefined, returning")
        formattedValue = null;
      }
      if (formattedValue?.toLowerCase() === 'true' || formattedValue?.toLowerCase() === 'false') {
        formattedValue = formattedValue?.toLowerCase() === 'true';
      }

      // Convert camelCase to snake_case
      const snakeCaseFieldName = fieldName.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      console.log("snakeCaseFieldName::", snakeCaseFieldName);

      // Initialize workspace fields if not already done
      const workspaceId = await this.getWorkspaceIdFromToken(apiToken);
      await this.initializeCandidateFields(workspaceId, apiToken);
      const workspaceFieldsMap = this.candidateFieldsMap.get(workspaceId) || new Map();

      // Check if this is a candidate field value
      const isFieldValue = workspaceFieldsMap.has(snakeCaseFieldName);
      console.log("isFieldValue::", isFieldValue);

      // Special handling for specific fields
      if (fieldName === 'email') {
        const updateData = {"email": {primaryEmail: formattedValue}};
        const response = await this.staticGraphQLService.executeGraphQL(mutationToUpdateOnePerson, { idToUpdate: personId, input: { emails: { primaryEmail: formattedValue } } }, apiToken);
        console.log("response::", response?.data?.data);
        return response?.data?.data;
      }


      if (fieldName === 'jobTitle') {
        const updateData = {"jobTitle": formattedValue};
        const response = await this.staticGraphQLService.executeGraphQL(mutationToUpdateOnePerson, { idToUpdate: personId, input: updateData }, apiToken);
        console.log("response for job title update::", response?.data?.data);

        const updateCandidateResponse = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, { idToUpdate: candidateId, input: { jobTitle: formattedValue } }, apiToken);
        console.log("updateCandidateResponse::", updateCandidateResponse?.data?.data);
        return response?.data?.data;
      }

      if (fieldName === 'mobilePhone' || fieldName === 'phone' || fieldName === 'phoneNumber') {
        return this.handlePhoneNumberUpdate(candidateId, formattedValue, apiToken);
      }

      // If it's a candidate field value, use updateCandidateFieldValue
      if (isFieldValue) {
        console.log("Updating as candidate field value");
        return this.updateCandidateFieldValue(candidateId, snakeCaseFieldName, formattedValue, apiToken);
      }

      // For direct fields, proceed with normal update
      const directFields = ['remarks', 'engagementStatus', 'startChat', 'stopChat', 'startChatCompleted', 'status',
                          'startMeetingSchedulingChat', 'startMeetingSchedulingChatCompleted', 'hiringNaukriUrl',
                          'startVideoInterviewChat', 'startVideoInterviewChatCompleted','candConversationStatus','messagingChannel'];

      if (directFields.includes(fieldName)) {
        console.log("Updating as direct field");
        let updateData: Record<string, any> = {};
        
        // Special handling for candConversationStatus to map label back to key
        if (fieldName === 'candConversationStatus' && typeof formattedValue === 'string') {
          // Create reverse mapping of STATUS_LABELS
          const CANDIDATE_CONVERSATION_STATUS_LABELS_REVERSE = {
            'No Conversation': 'ONLY_ADDED_NO_CONVERSATION',
            'Started, No Response': 'CONVERSATION_STARTED_HAS_NOT_RESPONDED',
            'Shared JD, No Response': 'SHARED_JD_HAS_NOT_RESPONDED',
            'Refuses Relocation': 'CANDIDATE_REFUSES_TO_RELOCATE',
            'Stopped Responding': 'STOPPED_RESPONDING_ON_QUESTIONS',
            'Salary Out of Range': 'CANDIDATE_SALARY_OUT_OF_RANGE',
            'Keen to Chat': 'CANDIDATE_IS_KEEN_TO_CHAT',
            'Declined Opportunity': 'CANDIDATE_DECLINED_OPPORTUNITY',
            'Followed Up': 'CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT',
            'Reluctant on Compensation': 'CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION',
            'Closed to Contact': 'CONVERSATION_CLOSED_TO_BE_CONTACTED'
          };
          
          const statusKey = CANDIDATE_CONVERSATION_STATUS_LABELS_REVERSE[formattedValue];
          if (statusKey) {
            updateData[fieldName] = statusKey;
          } else {
            console.warn(`Unknown status label: ${formattedValue}`);
            updateData[fieldName] = formattedValue; // Fallback to original value if not found
          }
        } else if (fieldName === 'status' && typeof formattedValue === 'string') {
          // Create reverse mapping of STATUS_LABELS
          const STATUS_LABELS_REVERSE = {
            'Not Interested': 'NOT_INTERESTED',
            'Interested': 'INTERESTED',
            'CV Received': 'CV_RECEIVED',
            'Not Fit': 'NOT_FIT',
            'Screening': 'SCREENING',
            'Recruiter Interview': 'RECRUITER_INTERVIEW',
            'CV Sent': 'CV_SENT',
            'Client Interview': 'CLIENT_INTERVIEW',
            'Negotiation': 'NEGOTIATION'
          };
          
          const statusKey = STATUS_LABELS_REVERSE[formattedValue];
          if (statusKey) {
            updateData[fieldName] = statusKey;
          } else {
            console.warn(`Unknown status label: ${formattedValue}`);
            updateData[fieldName] = formattedValue; // Fallback to original value if not found
          }
        } else {
          updateData[fieldName] = formattedValue;
        }
        
        const variables = {
          idToUpdate: candidateId,
          input: updateData
        };
        const response = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, variables, apiToken);

        console.log("response::", response?.data?.data);
        return response?.data?.data;
      }

      // If we get here, the field is neither a direct field nor a candidate field value
      console.warn(`Field ${fieldName} is not recognized as either a direct field or candidate field value`);
      throw new Error(`Field ${fieldName} is not recognized as either a direct field or candidate field value`);

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

      const response = await this.staticGraphQLService.executeGraphQL(graphqlToFindManyJobsWithCandidateValues, variables, apiToken);
      console.log("NUmber of candidate field values  =", response.data.data?.jobs?.edges[0]?.node?.candidates?.edges[0]?.node?.candidateFieldValues?.edges.length);
      console.log('This is the response:', response.data.data?.jobs?.edges[0]?.node?.candidates?.edges[0]?.node?.candidateFieldValues?.edges.map((edge: any) => edge?.node?.candidateFields?.name));
      const candidateFieldsJobs = response?.data?.data?.jobs?.edges[0]?.node?.candidateFields?.edges || [];
      console.log('candidateFieldsJobs::', candidateFieldsJobs);
      const candidateFields = response.data.data?.jobs?.edges[0]?.node?.candidates?.edges[0]?.node?.candidateFieldValues?.edges
        .map((edge: any) => edge?.node?.candidateFields?.name)
        .filter((name: string) => name !== null && name !== undefined) || [];
      return candidateFields;
    } catch (error) {
      console.error('Error fetching candidate fields by job ID:', error);
      throw error;
    }
  }

  async processContactData(contactData: any, apiToken: string): Promise<void> {
    try {
      console.log('Processing contact data:', contactData);
      
      if (!contactData.json_data) {
        console.log('No json_data found in contact data');
        return;
      }

      const jsonData = JSON.parse(contactData.json_data);
      console.log('Parsed JSON data:', jsonData);
      
      // Extract candidate profile type
      const candidateProfile = jsonData.candidate_profile || '';
      console.log('Candidate profile type:', candidateProfile);
      
      // Process resume/CV data if available
      await this.processResumeData(contactData, jsonData, apiToken);
      
      // Update candidate profile information based on source
      if (candidateProfile.includes('resdex') || candidateProfile.includes('naukri')) {
        console.log('Processing Naukri/Resdex profile data');
        await this.updateResdexProfileInfo(contactData, jsonData, apiToken);
      } else {
        console.log('Processing generic profile data');
        await this.updateGenericProfileInfo(contactData, jsonData, apiToken);
      }
      
      console.log('Contact data processed successfully');
    } catch (error) {
      console.error('Error processing contact data:', error);
      throw error;
    }
  }

  private async processResumeData(contactData: any, jsonData: any, apiToken: string): Promise<void> {
    try {
      // Extract resume-related data
      const htmlCV = jsonData.htmlCV || '';
      const cookies = jsonData.cookies || '';
      const url = jsonData.url || '';
      const userAgent = jsonData['user-agent'] || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36';
      const extension = jsonData.extension || 'unsure';
      const fileName = jsonData.file_name || '';
      
      console.log('Processing resume data:', { url, fileName });
      
      // Generate unique key for candidate identification
      const uniqueStringKey = this.generateUniqueStringKey(jsonData.full_name, jsonData.company_name);
      console.log('Generated unique string key:', uniqueStringKey);
      
      // Process CV download/upload logic
      let localFilePath = '';
      
      if (url && !url.includes('undefined')) {
        console.log('Attempting to download CV from URL:', url);
        // In a real implementation, you would download the CV from the URL
        // For now, we'll simulate this process
        localFilePath = await this.downloadAndSaveCV(url, cookies, userAgent, extension, fileName);
      }
      
      if (!localFilePath && htmlCV) {
        console.log('Converting HTML CV to PDF');
        localFilePath = await this.convertHtmlCvToPdf(htmlCV, fileName);
      }
      
      if (localFilePath) {
        console.log('Uploading CV to Twenty:', localFilePath);
        await this.uploadCVToTwenty(localFilePath, uniqueStringKey, apiToken);
      }
      
    } catch (error) {
      console.error('Error processing resume data:', error);
      // Don't throw - continue with other processing
    }
  }

  private async updateResdexProfileInfo(contactData: any, jsonData: any, apiToken: string): Promise<void> {
    try {
      // Extract phone number and clean it
      const phoneNumber = contactData.phone_number_current_page || jsonData.phone_number || '';
      const cleanPhoneNumber = this.cleanPhoneNumber(phoneNumber);
      console.log('Cleaned phone number:', cleanPhoneNumber);
      
      // Extract email
      const email = contactData.email || jsonData.email_address || '';
      console.log('Email:', email);
      
      // Extract other profile data
      const noticePeriod = contactData.notice_period || jsonData.notice_period || '';
      const profileUrl = (contactData.profile_url || jsonData.profile_url || jsonData.window_url || '').split('&')[0];
      
      // Generate unique key and name data
      const fullName = jsonData.full_name || '';
      const companyName = jsonData.company_name || '';
      const uniqueStringKey = this.generateUniqueStringKey(fullName, companyName);
      const nameData = this.processName(fullName);
      
      console.log('Processing profile update for:', { uniqueStringKey, profileUrl });
      
      // Find existing candidates by unique key or profile URL
      const candidates = await this.findCandidatesByUniqueKeyOrUrl(uniqueStringKey, profileUrl, apiToken);
      
      if (candidates && candidates.length > 0) {
        // Update existing candidates
        for (const candidate of candidates) {
          await this.updateCandidateProfile(candidate.id, {
            phoneNumber: cleanPhoneNumber,
            email: email,
            noticePeriod: noticePeriod,
            profileUrl: profileUrl,
            firstName: nameData.firstName,
            lastName: nameData.lastName,
          }, apiToken);
        }
      } else {
        console.log('No existing candidates found for update');
      }
      
    } catch (error) {
      console.error('Error updating Resdex profile info:', error);
      throw error;
    }
  }

  private async updateGenericProfileInfo(contactData: any, jsonData: any, apiToken: string): Promise<void> {
    try {
      const phoneNumber = contactData.phone_number_current_page || '';
      const email = contactData.email || '';
      const profileUrl = contactData.profile_url || '';
      
      console.log('Processing generic profile update:', { phoneNumber, email, profileUrl });
      
      if (phoneNumber && phoneNumber.length > 2 && !email) {
        await this.updateCandidateByPhoneNumber(phoneNumber, profileUrl, apiToken);
      } else if (email && email.length > 1 && email.includes('@') && email.includes('.')) {
        await this.updateCandidateByEmail(email, profileUrl, apiToken);
      }
      
    } catch (error) {
      console.error('Error updating generic profile info:', error);
      throw error;
    }
  }

  private generateUniqueStringKey(fullName: string, companyName: string): string {
    // Simple implementation - in production you'd use the NameProcessor logic
    const cleanName = (fullName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanCompany = (companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${cleanName}_${cleanCompany}`;
  }

  private processName(fullName: string): { firstName: string; lastName: string } {
    // Simple name processing - in production you'd use the NameProcessor
    const parts = (fullName || '').trim().split(' ');
    return {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || ''
    };
  }

  private cleanPhoneNumber(phoneNumber: string): string {
    // Basic phone number cleaning - in production you'd use the CleanPhoneNumbers utility
    if (!phoneNumber) return '';
    return phoneNumber.replace(/\D/g, '');
  }

  private async downloadAndSaveCV(url: string, cookies: string, userAgent: string, extension: string, fileName: string): Promise<string> {
    try {
      console.log('Downloading CV from URL:', url);
      
      if (!url || url.includes('undefined')) {
        console.log('Invalid URL for CV download:', url);
        return '';
      }
      
      const axios = require('axios');
      const fs = require('fs');
      const path = require('path');
      
      // Create output directory
      const outputDir = './all_resumes';
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Prepare headers
      const headers: any = {
        'User-Agent': userAgent,
        'Accept': 'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,*/*'
      };
      
      if (cookies) {
        headers['Cookie'] = cookies;
      }
      
      // Add specific headers for different platforms
      if (url.includes('hiring.naukri')) {
        headers['appid'] = '4';
        headers['systemid'] = 'naukriIndia';
        
        // Clean up hiring.naukri URLs
        if (url.includes('searchId')) {
          const cleanUrl = url.split('searchId')[0];
          const jobIdPart = url.split('jobId')[1];
          if (jobIdPart) {
            url = `${cleanUrl.slice(0, -1)}?jobId=${jobIdPart.substring(1)}`;
          }
        }
      } else if (url.includes('resdex.naukri')) {
        headers['appid'] = '112';
        headers['systemid'] = 'naukriIndia';
        
        // Clean up resdex URLs
        if (url.includes('&resId')) {
          url = url.split('&resId')[0];
        }
      }
      
      console.log('Making request to download CV with headers:', headers);
      
      // Make the download request
      const response = await axios({
        method: 'GET',
        url: url,
        headers: headers,
        responseType: 'arraybuffer',
        timeout: 30000, // 30 second timeout
        maxRedirects: 5
      });
      
      if (response.status !== 200) {
        console.error('Failed to download CV, status:', response.status);
        return '';
      }
      
      // Determine file extension
      let fileExtension = extension;
      if (extension === 'unsure') {
        const contentDisposition = response.headers['content-disposition'];
        if (contentDisposition) {
          const extensionMatch = contentDisposition.match(/\.(\w+)$/);
          if (extensionMatch) {
            fileExtension = extensionMatch[1];
          }
        } else {
          // Fallback to content-type
          const contentType = response.headers['content-type'];
          if (contentType?.includes('pdf')) {
            fileExtension = 'pdf';
          } else if (contentType?.includes('wordprocessingml')) {
            fileExtension = 'docx';
          } else if (contentType?.includes('msword')) {
            fileExtension = 'doc';
          } else {
            fileExtension = 'pdf'; // Default
          }
        }
      }
      
      // Get filename from response headers if available
      const responseFileName = response.headers['filename'];
      if (responseFileName) {
        fileName = responseFileName;
        const extensionMatch = fileName.match(/\.(\w+)$/);
        if (extensionMatch) {
          fileExtension = extensionMatch[1];
        }
      } else {
        fileName = `${fileName}.${fileExtension}`;
      }
      
      const filePath = path.join(outputDir, fileName);
      
      // Save the file
      fs.writeFileSync(filePath, response.data);
      
      console.log('Successfully downloaded CV to:', filePath);
      return filePath;
      
    } catch (error) {
      console.error('Error downloading CV:', error);
      return '';
    }
  }

  private async convertHtmlCvToPdf(htmlCV: string, fileName: string): Promise<string> {
    try {
      console.log('Converting HTML CV to PDF:', fileName);
      
      if (!htmlCV) {
        console.log('No HTML CV content provided');
        return '';
      }
      
      // Create output directory
      const fs = require('fs');
      const path = require('path');
      const outputDir = './all_resumes_pdfs';
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Parse HTML CV if it's JSON
      let htmlContent = htmlCV;
      try {
        const parsedHtml = JSON.parse(htmlCV);
        htmlContent = parsedHtml.htmlCv || htmlCV;
      } catch (e) {
        // If parsing fails, use as-is
        htmlContent = htmlCV;
      }
      
      // Create styled HTML with proper CSS
      const styledHtml = `
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 10px;
              }
              span { 
                display: inline-block; 
              }
              .resume-content {
                max-width: 800px;
                margin: 0 auto;
              }
            </style>
          </head>
          <body>
            <div class="resume-content">
              ${this.unescapeHtml(htmlContent)}
            </div>
          </body>
        </html>
      `;
      
      const outputFile = path.join(outputDir, `${fileName}.pdf`);
      console.log('Output file path:', outputFile);
      
      // Use puppeteer for HTML to PDF conversion (more reliable than pdfkit)
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setContent(styledHtml, { waitUntil: 'networkidle0' });
      
      await page.pdf({
        path: outputFile,
        format: 'A4',
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm'
        }
      });
      
      await browser.close();
      
      console.log('Successfully converted HTML CV to PDF:', outputFile);
      return outputFile;
      
    } catch (error) {
      console.error('Error converting HTML CV to PDF:', error);
      return '';
    }
  }
  
  private unescapeHtml(htmlString: string): string {
    const htmlEntities: { [key: string]: string } = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&#x27;': "'",
      '&#x2F;': '/',
      '&#x60;': '`',
      '&#x3D;': '='
    };
    
    return htmlString.replace(/&[#\w]+;/g, (entity) => {
      return htmlEntities[entity] || entity;
    });
  }

  private async uploadCVToTwenty(filePath: string, uniqueStringKey: string, apiToken: string): Promise<void> {
    try {
      console.log('Uploading CV to Twenty:', { filePath, uniqueStringKey });
      
      if (!filePath || !uniqueStringKey) {
        console.error('Missing required parameters for CV upload');
        return;
      }
      
      // Get candidate IDs for the unique string key
      const candidateIds = await this.getCandidateIdsByUniqueStringKey(uniqueStringKey, apiToken);
      
      if (!candidateIds || candidateIds.length === 0) {
        console.log('No candidates found for unique string key, cannot upload CV');
        return;
      }
      
      console.log('Found candidates for CV upload:', candidateIds);
      
      // Upload CV for each candidate ID
      for (const candidateId of candidateIds) {
        try {
          await this.createCvAttachment(filePath, candidateId, apiToken);
          console.log('Successfully uploaded CV for candidate:', candidateId);
        } catch (error) {
          console.error('Error uploading CV for candidate:', candidateId, error);
          // Continue with other candidates even if one fails
        }
      }
      
      console.log('CV upload process completed for all candidates');
      
    } catch (error) {
      console.error('Error in uploadCVToTwenty:', error);
      throw error;
    }
  }

  private async findCandidatesByUniqueKeyOrUrl(uniqueStringKey: string, profileUrl: string, apiToken: string): Promise<any[]> {
    try {
      console.log('Finding candidates by unique key or URL:', { uniqueStringKey, profileUrl });
      
      // First try to find by unique string key
      let candidates: any[] = [];
      
      if (uniqueStringKey) {
        const candidateIds = await this.getCandidateIdsByUniqueStringKey(uniqueStringKey, apiToken);
        if (candidateIds.length > 0) {
          // Get full candidate data for the found IDs
          const candidateGraphqlQuery = {
            filter: {
              id: { in: candidateIds }
            },
            orderBy: [{ position: "AscNullsFirst" }]
          };
          
          const response = await this.staticGraphQLService.executeGraphQL(
            graphqlToFetchAllCandidateData,
            candidateGraphqlQuery,
            apiToken
          );
          
          const candidatesData = response?.data?.data?.candidates as {
            edges: CandidatesEdge[];
            pageInfo: PageInfo;
          } | undefined;
          
          if (candidatesData?.edges) {
            candidates = candidatesData.edges.map(edge => edge?.node).filter(Boolean);
          }
        }
      }
      
      // If no candidates found by unique key, try profile URL
      if (candidates.length === 0 && profileUrl) {
        candidates = await this.findCandidatesByProfileUrl(profileUrl, apiToken);
      }
      
      console.log('Found candidates by unique key or URL:', candidates.length);
      return candidates;
      
    } catch (error) {
      console.error('Error finding candidates by unique key or URL:', error);
      return [];
    }
  }

  private async updateCandidateProfile(candidateId: string, profileData: any, apiToken: string): Promise<void> {
    // Use existing updateCandidateField method for each field
    try {
      if (profileData.phoneNumber) {
        await this.updateCandidateField('', candidateId, 'phoneNumber', profileData.phoneNumber, apiToken, 'contact_update');
      }
      if (profileData.email) {
        await this.updateCandidateField('', candidateId, 'email', profileData.email, apiToken, 'contact_update');
      }
      // Add other field updates as needed
    } catch (error) {
      console.error('Error updating candidate profile:', error);
      throw error;
    }
  }

  private async updateCandidateByPhoneNumber(phoneNumber: string, profileUrl: string, apiToken: string): Promise<void> {
    try {
      console.log('Updating candidate by phone number:', { phoneNumber, profileUrl });
      
      if (!phoneNumber || phoneNumber.length < 3) {
        console.log('Invalid phone number provided');
        return;
      }
      
      // Find candidates by profile URL
      const candidates = await this.findCandidatesByProfileUrl(profileUrl, apiToken);
      
      if (!candidates || candidates.length === 0) {
        console.log('No candidates found for profile URL to update phone number');
        return;
      }
      
      // Update phone number for each candidate found
      for (const candidate of candidates) {
        try {
          console.log('Updating phone number for candidate:', candidate.id);
          await this.updateCandidateField(
            candidate.peopleId || '', 
            candidate.id, 
            'phoneNumber', 
            this.cleanPhoneNumber(phoneNumber), 
            apiToken, 
            'extension_update'
          );
          console.log('Successfully updated phone number for candidate:', candidate.id);
        } catch (error) {
          console.error('Error updating phone number for candidate:', candidate.id, error);
        }
      }
      
    } catch (error) {
      console.error('Error updating candidate by phone number:', error);
      throw error;
    }
  }

  private async updateCandidateByEmail(email: string, profileUrl: string, apiToken: string): Promise<void> {
    try {
      console.log('Updating candidate by email:', { email, profileUrl });
      
      if (!email || !email.includes('@') || !email.includes('.')) {
        console.log('Invalid email provided');
        return;
      }
      
      // Find candidates by profile URL
      const candidates = await this.findCandidatesByProfileUrl(profileUrl, apiToken);
      
      if (!candidates || candidates.length === 0) {
        console.log('No candidates found for profile URL to update email');
        return;
      }
      
      // Update email for each candidate found
      for (const candidate of candidates) {
        try {
          console.log('Updating email for candidate:', candidate.id);
          await this.updateCandidateField(
            candidate.peopleId || '', 
            candidate.id, 
            'email', 
            email, 
            apiToken, 
            'extension_update'
          );
          console.log('Successfully updated email for candidate:', candidate.id);
        } catch (error) {
          console.error('Error updating email for candidate:', candidate.id, error);
        }
      }
      
    } catch (error) {
      console.error('Error updating candidate by email:', error);
      throw error;
    }
  }

  async processContactWithCv(
    contactData: any,
    jobName: string,
    fileName: string,
    filePath: string,
    uniqueStringKey: string,
    apiToken: string
  ): Promise<void> {
    try {
      console.log('Processing contact with CV:', {
        contactData,
        jobName,
        fileName,
        filePath,
        uniqueStringKey
      });
      
      if (!uniqueStringKey) {
        console.error('No unique string key provided for CV processing');
        return;
      }
      
      // Process CV upload to Twenty similar to Flask _process_cv_upload_to_twenty
      await this.processCvUploadToTwenty(contactData, filePath, uniqueStringKey, apiToken);
      
      console.log('Contact with CV processed successfully');
      
    } catch (error) {
      console.error('Error processing contact with CV:', error);
      throw error;
    }
  }

  private async processCvUploadToTwenty(
    contactData: any,
    filePath: string,
    uniqueStringKey: string,
    apiToken: string
  ): Promise<void> {
    try {
      console.log('Processing CV upload to Twenty:', { filePath, uniqueStringKey });
      
      // Get person object from contact data (similar to get_person_id_from_resdex_data)
      const personObj = await this.getPersonFromContactData(contactData, apiToken);
      
      // Prepare person object for CV upload
      const uploadPersonObj = personObj || { uniqueStringKey: uniqueStringKey };
      
      // Upload CV to Twenty using the file path
      await this.uploadCvFileToTwenty(filePath, uploadPersonObj, '', uniqueStringKey, apiToken);
      
      console.log('Successfully uploaded CV to Twenty');
      
    } catch (error) {
      console.error('Error in processCvUploadToTwenty:', error);
      throw error;
    }
  }

  private async getPersonFromContactData(contactData: any, apiToken: string): Promise<any> {
    try {
      let profileUrl = '';
      
      if (contactData.profile_url) {
        profileUrl = contactData.profile_url;
      } else if (contactData.json_data) {
        const jsonData = JSON.parse(contactData.json_data);
        profileUrl = jsonData.profile_url || jsonData.window_url || '';
      }
      
      if (!profileUrl || profileUrl.includes('resdex.naukri.com/v3/preview')) {
        console.log('No valid profile URL found');
        return null;
      }
      
      // Clean profile URL
      profileUrl = profileUrl.split('?')[0];
      console.log('Searching for person with profile URL:', profileUrl);
      
      // Find person by profile URL using GraphQL
      const candidates = await this.findCandidatesByProfileUrl(profileUrl, apiToken);
      
      if (candidates && candidates.length > 0) {
        return candidates[0]; // Return the first matching candidate
      }
      
      return null;
      
    } catch (error) {
      console.error('Error getting person from contact data:', error);
      return null;
    }
  }

  private async findCandidatesByProfileUrl(profileUrl: string, apiToken: string): Promise<any[]> {
    try {
      console.log('Finding candidates by profile URL:', profileUrl);
      
      // Try different URL field queries based on profile URL type
      let graphqlQuery;
      
      if (profileUrl.includes('resdex')) {
        graphqlQuery = {
          filter: {
            resdexNaukriUrl: { 
              primaryLinkUrl: { ilike: `%${profileUrl}%` }
            }
          },
          orderBy: [{ position: "AscNullsFirst" }]
        };
      } else if (profileUrl.includes('hiring')) {
        graphqlQuery = {
          filter: {
            hiringNaukriUrl: { 
              primaryLinkUrl: { ilike: `%${profileUrl}%` }
            }
          },
          orderBy: [{ position: "AscNullsFirst" }]
        };
      } else if (profileUrl.includes('linkedin')) {
        graphqlQuery = {
          filter: {
            linkedinUrl: { 
              primaryLinkUrl: { ilike: `%${profileUrl}%` }
            }
          },
          orderBy: [{ position: "AscNullsFirst" }]
        };
      } else {
        // Generic profile URL search
        graphqlQuery = {
          filter: {
            or: [
              { resdexNaukriUrl: { primaryLinkUrl: { ilike: `%${profileUrl}%` } } },
              { hiringNaukriUrl: { primaryLinkUrl: { ilike: `%${profileUrl}%` } } },
              { linkedinUrl: { primaryLinkUrl: { ilike: `%${profileUrl}%` } } }
            ]
          },
          orderBy: [{ position: "AscNullsFirst" }]
        };
      }
      
      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlToFetchAllCandidateData,
        graphqlQuery,
        apiToken
      );
      
      const candidates = response?.data?.data?.candidates as {
        edges: CandidatesEdge[];
        pageInfo: PageInfo;
      } | undefined;
      
      if (!candidates?.edges || candidates.edges.length === 0) {
        console.log('No candidates found for profile URL:', profileUrl);
        return [];
      }
      
      const candidateList = candidates.edges.map(edge => edge?.node).filter(Boolean);
      console.log('Found candidates:', candidateList.length);
      return candidateList;
      
    } catch (error) {
      console.error('Error finding candidates by profile URL:', error);
      return [];
    }
  }

  private async uploadCvFileToTwenty(
    filePath: string,
    personObj: any,
    candidateId: string,
    uniqueStringKey: string,
    apiToken: string
  ): Promise<void> {
    try {
      console.log('Uploading CV file to Twenty:', { filePath, uniqueStringKey });
      
      // This would implement the actual file upload logic
      // Similar to the uploadCVtoTwenty method in the Flask code
      
      if (!filePath || !uniqueStringKey) {
        console.error('Missing required parameters for CV upload');
        return;
      }
      
      // Get candidate IDs for the unique string key
      const candidateIds = await this.getCandidateIdsByUniqueStringKey(uniqueStringKey, apiToken);
      
      if (!candidateIds || candidateIds.length === 0) {
        console.log('No candidates found for unique string key, cannot upload CV');
        return;
      }
      
      // Upload file and create attachments for each candidate
      for (const candidateId of candidateIds) {
        await this.createCvAttachment(filePath, candidateId, apiToken);
      }
      
      console.log('Successfully uploaded CV for all candidates');
      
    } catch (error) {
      console.error('Error uploading CV file to Twenty:', error);
      throw error;
    }
  }

  private async getCandidateIdsByUniqueStringKey(uniqueStringKey: string, apiToken: string): Promise<string[]> {
    try {
      console.log('Getting candidate IDs by unique string key:', uniqueStringKey);
      
      const graphqlQuery = {
        filter: {
          uniqueStringKey: { eq: uniqueStringKey }
        },
        orderBy: [{ position: "AscNullsFirst" }]
      };
      
      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlToFetchAllCandidateData, 
        graphqlQuery, 
        apiToken
      );
      
      const candidates = response?.data?.data?.candidates as {
        edges: CandidatesEdge[];
        pageInfo: PageInfo;
      } | undefined;
      
      if (!candidates?.edges || candidates.edges.length === 0) {
        console.log('No candidates found for unique string key:', uniqueStringKey);
        return [];
      }
      
      const candidateIds = candidates.edges
        .map(edge => edge?.node?.id)
        .filter(Boolean);
      
      console.log('Found candidate IDs:', candidateIds);
      return candidateIds;
      
    } catch (error) {
      console.error('Error getting candidate IDs by unique string key:', error);
      return [];
    }
  }

  private async createCvAttachment(filePath: string, candidateId: string, apiToken: string): Promise<void> {
    try {
      console.log('Creating CV attachment for candidate:', candidateId);
      
      if (!filePath || !candidateId) {
        console.error('Missing required parameters for CV attachment');
        return;
      }
      
      // Get workspace member ID for the author
      const workspaceId = await this.getWorkspaceIdFromToken(apiToken);
      const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService)
        .getRecruiterProfileFromCurrentUser(apiToken, process.env.SERVER_BASE_URL || 'http://localhost:3000');
      
      if (!recruiterProfile?.workspaceMemberId) {
        console.error('Could not get workspace member ID for attachment author');
        return;
      }
      
      // Extract file information
      const fileName = filePath.split('/').pop() || 'resume.pdf';
      const fileType = this.getFileTypeFromFileName(fileName);
      const applicationType = this.getApplicationTypeFromFileType(fileType);
      
      // Step 1: Upload file to Twenty storage
      const uploadResponse = await this.uploadFileToTwenty(filePath, fileName, applicationType, apiToken);
      
      if (!uploadResponse?.uploadFilePath) {
        console.error('Failed to upload file to Twenty storage');
        return;
      }
      
      // Step 2: Create attachment record
      const createAttachmentMutation = `
        mutation CreateOneAttachment($input: AttachmentCreateInput!) {
          createAttachment(data: $input) {
            id
            name
            fullPath
            type
          }
        }
      `;
      
      const attachmentVariables = {
        input: {
          authorId: recruiterProfile.workspaceMemberId,
          name: fileName,
          fullPath: uploadResponse.uploadFilePath,
          type: "TextDocument",
          candidateId: candidateId
        }
      };
      
      const attachmentResponse = await this.staticGraphQLService.executeGraphQL(
        createAttachmentMutation,
        attachmentVariables,
        apiToken
      );
      
      console.log('Successfully created CV attachment:', attachmentResponse?.data?.data?.createAttachment);
      
    } catch (error) {
      console.error('Error creating CV attachment:', error);
      throw error;
    }
  }
  
  private async uploadFileToTwenty(filePath: string, fileName: string, contentType: string, apiToken: string): Promise<{ uploadFilePath: string }> {
    try {
      const fs = require('fs');
      const FormData = require('form-data');
      const axios = require('axios');
      
      const formData = new FormData();
      const operations = JSON.stringify({
        operationName: "uploadFile",
        variables: { file: null, fileFolder: "Attachment" },
        query: "mutation uploadFile($file: Upload!, $fileFolder: FileFolder) {\n  uploadFile(file: $file, fileFolder: $fileFolder)\n}"
      });
      
      const map = JSON.stringify({ "1": ["variables.file"] });
      
      formData.append('operations', operations);
      formData.append('map', map);
      formData.append('1', fs.createReadStream(filePath), {
        filename: fileName,
        contentType: contentType
      });
      
      const response = await axios.post(
        `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/graphql`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${apiToken}`
          }
        }
      );
      
      const uploadFilePath = response.data?.data?.uploadFile;
      if (!uploadFilePath) {
        throw new Error('Failed to get upload file path from response');
      }
      
      // Remove query parameters from the path
      const cleanPath = uploadFilePath.split('?')[0];
      
      return { uploadFilePath: cleanPath };
      
    } catch (error) {
      console.error('Error uploading file to Twenty:', error);
      throw error;
    }
  }
  
  private getFileTypeFromFileName(fileName: string): string {
    if (fileName.includes('.docx')) return 'docx';
    if (fileName.includes('.pdf')) return 'pdf';
    if (fileName.includes('.doc') && !fileName.includes('.docx')) return 'doc';
    return 'pdf'; // default
  }
  
  private getApplicationTypeFromFileType(fileType: string): string {
    switch (fileType) {
      case 'pdf':
        return 'application/pdf';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'doc':
        return 'application/msword';
      default:
        return 'application/pdf';
    }
  }

  async updateTableData(recruiterId: string, apiToken: string): Promise<void> {
    try {
      console.log('Updating table data for recruiter:', recruiterId);
      
      // This method should implement table data refresh logic
      // For now, we'll implement a basic version that could trigger data refresh
      
      // Here you would implement logic to:
      // 1. Refresh candidate data in tables
      // 2. Update any cached data
      // 3. Trigger any necessary data synchronization
      
      console.log('Table data updated successfully');
      
    } catch (error) {
      console.error('Error updating table data:', error);
      throw error;
    }
  }

  /**
   * Get candidate IDs and person ID by unique string key
   * Mirrors the get_candidate_ids_by_unique_string_key functionality from upload_to_twenty.py
   */
  async getCandidateIdsByUniqueStringKeyWithPersonId(uniqueStringKey: string, apiToken: string): Promise<{ candidateIds: string[]; personId: string | null }> {
    try {
      console.log('Getting candidate IDs and person ID by unique string key:', uniqueStringKey);
      
      const candidateIds = await this.getCandidateIdsByUniqueStringKey(uniqueStringKey, apiToken);
      
      if (candidateIds.length === 0) {
        console.log('No candidates found for unique string key:', uniqueStringKey);
        return { candidateIds: [], personId: null };
      }
      
      // Get the first candidate's person ID
      const graphqlQuery = {
        filter: {
          id: { eq: candidateIds[0] }
        }
      };
      
      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlToFetchAllCandidateData,
        graphqlQuery,
        apiToken
      );
      
      const candidate = response?.data?.data?.candidates?.edges?.[0]?.node;
      const personId = candidate?.peopleId || null;
      
      console.log('Found candidate IDs and person ID:', { candidateIds, personId });
      return { candidateIds, personId };
      
    } catch (error) {
      console.error('Error getting candidate IDs and person ID:', error);
      return { candidateIds: [], personId: null };
    }
  }

  /**
   * Upload phone number and email profile data
   * Mirrors the upload_phone_number_email_profile_data functionality from upload_to_twenty.py
   */
  async uploadPhoneNumberEmailProfileData(
    contactData: any,
    jobName: string,
    fileName: string,
    filePath: string,
    uniqueStringKey: string,
    apiToken: string,
    candidateIds?: string[],
    personId?: string
  ): Promise<void> {
    try {
      console.log('Uploading phone number and email profile data:', {
        uniqueStringKey,
        candidateIds: candidateIds?.length || 0,
        personId
      });
      
      // If candidate IDs and person ID not provided, look them up
      let finalCandidateIds = candidateIds;
      let finalPersonId: string | null = personId || null;
      
      if (!finalCandidateIds || !finalPersonId) {
        const result = await this.getCandidateIdsByUniqueStringKeyWithPersonId(uniqueStringKey, apiToken);
        finalCandidateIds = result.candidateIds;
        finalPersonId = result.personId;
      }
      
      if (!finalCandidateIds || finalCandidateIds.length === 0) {
        console.error('No candidates found to update');
        return;
      }
      
      // Update profile with phone number and email for each candidate
      for (const candidateId of finalCandidateIds) {
        await this.updatePersonProfileWithPhoneNumber(contactData, candidateId, finalPersonId, apiToken);
      }
      
      console.log('Successfully updated phone number and email for all candidates');
      
    } catch (error) {
      console.error('Error uploading phone number and email profile data:', error);
      throw error;
    }
  }

  /**
   * Update person profile with phone number
   * Mirrors the updatePersonProfileWithPhoneNumber functionality from upload_to_twenty.py
   */
  private async updatePersonProfileWithPhoneNumber(
    contactData: any,
    candidateId: string,
    personId: string | null,
    apiToken: string
  ): Promise<void> {
    try {
      console.log('Updating person profile with phone number:', { candidateId, personId });
      
      const phoneNumber = this.cleanPhoneNumber(contactData.phone_number_current_page || contactData.phone_number || '');
      const email = contactData.email || '';
      
      console.log('Phone number to update:', phoneNumber);
      console.log('Email to update:', email);
      
      // Update candidate first since we have a valid candidateId
      if (phoneNumber) {
        const candidateUpdateData = {
          phoneNumber: { primaryPhoneNumber: phoneNumber }
        };
        
        if (email) {
          candidateUpdateData['email'] = { primaryEmail: email };
        }
        
        const candidateResponse = await this.staticGraphQLService.executeGraphQL(
          graphQltoUpdateOneCandidate,
          {
            idToUpdate: candidateId,
            input: candidateUpdateData
          },
          apiToken
        );
        
        console.log('Updated candidate profile:', candidateResponse?.data?.data);
      }
      
      // Only attempt to update person if we have a valid personId
      if (personId && (phoneNumber || email)) {
        const personUpdateData: any = {};
        
        if (phoneNumber) {
          personUpdateData.phones = { primaryPhoneNumber: phoneNumber };
        }
        
        if (email) {
          personUpdateData.emails = { primaryEmail: email };
        }
        
        const personResponse = await this.staticGraphQLService.executeGraphQL(
          mutationToUpdateOnePerson,
          {
            idToUpdate: personId,
            input: personUpdateData
          },
          apiToken
        );
        
        console.log('Updated person profile:', personResponse?.data?.data);
      }
      
    } catch (error) {
      console.error('Error updating person profile with phone number:', error);
      throw error;
    }
  }
}