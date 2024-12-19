import { Injectable } from '@nestjs/common';
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


@Injectable()
export class CandidateService {
  constructor(
    private readonly jobService: JobService,
    private readonly personService: PersonService,
    private readonly workspaceQueryService: WorkspaceQueryService,

) {}

async createRelationsBasedonObjectMap(jobCandidateObjectId: string, jobCandidateObjectName: string, apiToken: string): Promise<void> {
  const objectsNameIdMap = await new CreateMetaDataStructure(this.workspaceQueryService).fetchObjectsNameIdMap(apiToken);
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
  ];
  await createRelations(relationsToCreate, apiToken);
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
    const response = await axiosRequest(graphqlQuery, apiToken);
    const candidatesMap = new Map<string, any>();
    
    response.data?.data?.candidates?.edges?.forEach((edge: any) => {
      if (edge?.node?.uniqueStringKey) {
        candidatesMap.set(edge.node.uniqueStringKey, edge.node);
      }
    });
    
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
  
  
  
  // async processProfilesWithRateLimiting(
  //   data: CandidateSourcingTypes.UserProfile[], 
  //   jobObject: CandidateSourcingTypes.Jobs, 
  //   apiToken: string
  // ): Promise<{ 
  //   manyPersonObjects: CandidateSourcingTypes.ArxenaPersonNode[];  
  //   manyCandidateObjects: CandidateSourcingTypes.ArxenaCandidateNode[]; 
  //   allPersonObjects: allDataObjects.PersonNode[];
  //   manyJobCandidateObjects: CandidateSourcingTypes.ArxenaJobCandidateNode[] 
  // }> {
  //   console.log("Single Profile:", data[0]);
  //   console.log('Total number of profiles received:', data.length);
    
  //   const manyPersonObjects: CandidateSourcingTypes.ArxenaPersonNode[] = [];
  //   const allPersonObjects: allDataObjects.PersonNode[] = [];
  //   const manyCandidateObjects: CandidateSourcingTypes.ArxenaCandidateNode[] = [];
  //   const manyJobCandidateObjects: CandidateSourcingTypes.ArxenaJobCandidateNode[] = [];
  
  //   const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
  //   // Create or get job candidate object structure
  //   console.log("Received this jobObj:", jobObject);
  //   const path_position = JobCandidateUtils.getJobCandidatePathPosition(jobObject.name, jobObject?.arxenaSiteId);
  //   const jobCandidateObjectName = `${path_position}JobCandidate`;
  //   console.log('Job candidate object name:', jobCandidateObjectName);
    
  //   let jobCandidateObjectId;
  //   const objectsNameIdMap = await new CreateMetaDataStructure(this.workspaceQueryService).fetchObjectsNameIdMap(apiToken);
    
  //   try {
  //     console.log('ObjectsNameIdMap:', objectsNameIdMap);
  //     if (objectsNameIdMap[jobCandidateObjectName]) {
  //       console.log('Using existing job candidate object:', jobCandidateObjectName);
  //       jobCandidateObjectId = objectsNameIdMap[jobCandidateObjectName];
  //     } else {
  //       console.log('Creating new job candidate object structure:', jobCandidateObjectName);
  //       try {
  //         jobCandidateObjectId = await this.createNewJobCandidateObject(jobObject, apiToken);
  //         if (jobCandidateObjectId) {
  //           console.log("Job candidate object created successfully:", jobCandidateObjectId);
  //           console.log("Creating relations for job candidate object");
  //           this.createRelationsBasedonObjectMap(jobCandidateObjectId, jobCandidateObjectName, apiToken);
  //         }
  //       } catch(error) {
  //         console.log("Error in creating new job candidate object:", error);
  //         const objectsNameIdMap = await new CreateMetaDataStructure(this.workspaceQueryService).fetchObjectsNameIdMap(apiToken);
  //         jobCandidateObjectId = objectsNameIdMap[jobCandidateObjectName];
  //       }
  //     }
  //     console.log('Job candidate object ID:', jobCandidateObjectId);
  //   } catch (error) {
  //     console.log('Error in fetching or creating job candidate object:', error);
  //   }
  
  //   const personIdMap = new Map<string, string>();
  //   const candidateIdMap = new Map<string, string>();
    
  //   try {
  //     const batchSize = 15;
  
  //     // Process profiles in batches
  //     for (let i = 0; i < data.length; i += batchSize) {
  //       const batch = data.slice(i, i + batchSize);
  //       const uniqueStringKeys = batch.map(profile => profile?.unique_key_string).filter(Boolean);
  
  //       // Batch get person and candidate details
  //       const personDetailsMap = await this.personService.batchGetPersonDetailsByStringKeys(uniqueStringKeys, apiToken);
  //       const candidatesMap = await this.batchCheckExistingCandidates(uniqueStringKeys, jobObject.id, apiToken);
  
  //       let personNodesToCreate: CandidateSourcingTypes.ArxenaPersonNode[] = [];
  //       let candidateNodesToCreate: CandidateSourcingTypes.ArxenaCandidateNode[] = [];
        
  //       let personNodeUniqueKeys: string[] = [];
  //       let candidateNodeUniqueKeys: string[] = [];
  
  //       // Process each profile in the batch
  //       for (const profile of batch) {
  //         const unique_key_string = profile?.unique_key_string;
  //         if (!unique_key_string) {
  //           console.log("Unique key string not found:", unique_key_string, "for profile", profile);
  //           continue;
  //         }
  
  //         console.log("Processing unique key string:", unique_key_string);
  //         const personObj = personDetailsMap?.get(unique_key_string);
  //         const { personNode, candidateNode, jobCandidateNode } = await processArxCandidate(profile, jobObject);
          
  //         // Handle person creation
  //         try {
  //           if (!personObj || !personObj?.name) {
  //             personNodesToCreate.push(personNode);
  //             personNodeUniqueKeys.push(unique_key_string);
  //             manyPersonObjects.push(personNode);
  //           } else {
  //             const personId = personObj?.id;
  //             allPersonObjects.push(personObj);
  //             console.log("PersonId when found:", personId);
  //             personIdMap.set(unique_key_string, personId);
  //           }
  //         } catch (error) {
  //           console.log('Error in processing person:', error);
  //           continue;
  //         }
  
  //         // Create people in batches
  //         if (personNodesToCreate.length === 15 || profile === batch[batch.length - 1]) {
  //           if (personNodesToCreate.length > 0) {
  //             try {
  //               const responseForPeople = await this.personService.createPeople(personNodesToCreate, apiToken);
  //               responseForPeople?.data?.data?.createPeople?.forEach((person, index) => {
  //                 const uniqueKey = personNodeUniqueKeys[index];
  //                 if (person?.id && uniqueKey) {
  //                   personIdMap.set(uniqueKey, person.id);
  //                 }
  //               });
  //             } catch (error) {
  //               console.log('Error in batch creating people:', error);
  //             }
  //             personNodesToCreate = [];
  //             personNodeUniqueKeys = [];
  //           }
  //         }
  
  //         // Handle candidate creation
  //         const existingCandidate = candidatesMap.get(unique_key_string);
  //         const personIdForCandidate = personIdMap.get(unique_key_string);
  
  //         if (personIdForCandidate && !existingCandidate) {
  //           candidateNode.peopleId = personIdForCandidate;
  //           if (candidateNode.peopleId) {
  //             candidateNodesToCreate.push(candidateNode);
  //             candidateNodeUniqueKeys.push(unique_key_string);
  //             manyCandidateObjects.push(candidateNode);
  //           }
  //         } else if (existingCandidate) {
  //           candidateIdMap.set(unique_key_string, existingCandidate.id);
  //         }
  
  //         // Create candidates in batches
  //         if (candidateNodesToCreate.length === 15 || profile === batch[batch.length - 1]) {
  //           if (candidateNodesToCreate.length > 0) {
  //             const validCandidates = candidateNodesToCreate.filter(c => c.peopleId && c.peopleId !== '');
  //             if (validCandidates.length > 0) {
  //               try {
  //                 const responseForCandidates = await this.createCandidates(validCandidates, apiToken);
  //                 responseForCandidates?.data?.data?.createCandidates?.forEach((candidate, index) => {
  //                   const uniqueKey = candidateNodeUniqueKeys[index];
  //                   if (candidate?.id && uniqueKey) {
  //                     candidateIdMap.set(uniqueKey, candidate.id);
  //                   }
  //                 });
  //               } catch (error) {
  //                 console.log('Error in batch creating candidates:', error);
  //               }
  //             }
  //             candidateNodesToCreate = [];
  //             candidateNodeUniqueKeys = [];
  //           }
  //         }
  //       }
  
  //       // Batch check existing job candidates
  //       const batchPersonIds = batch
  //         .map(profile => personIdMap.get(profile?.unique_key_string))
  //         .filter((id): id is string => !!id);
        
  //       const batchCandidateIds = batch
  //         .map(profile => candidateIdMap.get(profile?.unique_key_string))
  //         .filter((id): id is string => !!id);
  
  //       const existingJobCandidatesMap = await this.batchCheckExistingJobCandidates(
  //         batchPersonIds,
  //         batchCandidateIds,
  //         jobObject.id,
  //         jobObject,
  //         apiToken
  //       );
  
  //       // Process job candidates
  //       for (const profile of batch) {
  //         const personId = personIdMap.get(profile?.unique_key_string);
  //         const candidateId = candidateIdMap.get(profile?.unique_key_string);
          
  //         if (personId && candidateId) {
  //           const compositeKey = `${personId}_${candidateId}`;
  //           const existingJobCandidate = existingJobCandidatesMap.get(compositeKey);
            
  //           if (!existingJobCandidate) {
  //             const { personNode, candidateNode, jobCandidateNode } = await processArxCandidate(profile, jobObject);
  //             jobCandidateNode.personId = personId;
  //             jobCandidateNode.candidateId = candidateId;
  //             jobCandidateNode.jobId = jobObject.id;
              
  //             if (!manyJobCandidateObjects.some(jc => 
  //               jc.personId === jobCandidateNode.personId && 
  //               jc.candidateId === jobCandidateNode.candidateId && 
  //               jc.jobId === jobCandidateNode.jobId
  //             )) {
  //               manyJobCandidateObjects.push(jobCandidateNode);
  //             }
  //           }
  //         }
  //       }
  
  //       // Rate limiting delay
  //       if (i + batchSize < data.length) {
  //         await delay(1000);
  //       }
  //     }
  
  //     // Create job candidate object fields and relations
  //     try {
  //       if (jobCandidateObjectId) {
  //         const { personNode, candidateNode, jobCandidateNode } = await processArxCandidate(data[0], jobObject);
  //         await this.createObjectFieldsAndRelations(jobCandidateObjectId, jobCandidateObjectName, jobCandidateNode, apiToken);
  //       }
  //     } catch (error) {
  //       console.log("Error in creating object fields and relations:", error);
  //     }
  
  //     // Create final job candidates batch
  //     if (manyJobCandidateObjects.length > 0) {
  //       console.log("Creating job candidates batch, count:", manyJobCandidateObjects.length);
  //       console.log("Sample candidate:", manyJobCandidateObjects[0]);
        
  //       const graphqlQueryObjForJobCandidates = JSON.stringify({
  //         query: await new JobCandidateUtils().generateJobCandidatesMutation(path_position),
  //         variables: { data: manyJobCandidateObjects },
  //       });
  
  //       const jobCandidatesResponse = await axiosRequest(graphqlQueryObjForJobCandidates, apiToken);
  //       console.log('Successfully created job candidates:', jobCandidatesResponse?.data);
  //     } else {
  //       console.log('No new job candidate relationships to create');
  //     }
  
  //   } catch (error) {
  //     console.log('Error in processing profiles:', error);
  //   }
  
  //   console.log('Final counts:');
  //   console.log('Person objects:', manyPersonObjects.length);
  //   console.log('Candidate objects:', manyCandidateObjects.length);
  //   console.log('All person objects:', allPersonObjects.length);
  //   console.log('Job candidate objects:', manyJobCandidateObjects.length);
    
  //   return { 
  //     manyPersonObjects, 
  //     manyCandidateObjects, 
  //     allPersonObjects,
  //     manyJobCandidateObjects 
  //   };
  // }


  async processProfilesWithRateLimiting(
    data: CandidateSourcingTypes.UserProfile[], 
    jobObject: CandidateSourcingTypes.Jobs, 
    apiToken: string
  ): Promise<{ 
    manyPersonObjects: CandidateSourcingTypes.ArxenaPersonNode[];  
    manyCandidateObjects: CandidateSourcingTypes.ArxenaCandidateNode[]; 
    allPersonObjects: allDataObjects.PersonNode[];
    manyJobCandidateObjects: CandidateSourcingTypes.ArxenaJobCandidateNode[] 
  }> {
    console.log("Starting profile processing. Total profiles:", data.length);
    
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const batchSize = 15;
    
    const results = {
      manyPersonObjects: [] as CandidateSourcingTypes.ArxenaPersonNode[],
      allPersonObjects: [] as allDataObjects.PersonNode[],
      manyCandidateObjects: [] as CandidateSourcingTypes.ArxenaCandidateNode[],
      manyJobCandidateObjects: [] as CandidateSourcingTypes.ArxenaJobCandidateNode[]
    };
  
    const tracking = {
      personIdMap: new Map<string, string>(),
      candidateIdMap: new Map<string, string>()
    };
  
    try {
      // 1. Set up job candidate object structure
      const jobCandidateInfo = await this.setupJobCandidateStructure(jobObject, apiToken);
      if (!jobCandidateInfo.jobCandidateObjectId) {
        throw new Error('Failed to create/get job candidate object structure');
      }

      // 6. Set up metadata fields
      if (jobCandidateInfo.jobCandidateObjectId && data.length > 0) {
        const { jobCandidateNode } = await processArxCandidate(data[0], jobObject);
        await this.createObjectFieldsAndRelations(
          jobCandidateInfo.jobCandidateObjectId,
          jobCandidateInfo.jobCandidateObjectName,
          jobCandidateNode,
          apiToken
        );
      }
  
      // 2. Process data in batches
      for (let i = 0; i < data.length; i += batchSize) {
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(data.length/batchSize)}`);
        
        const batch = data.slice(i, i + batchSize);
        const uniqueStringKeys = batch.map(p => p?.unique_key_string).filter(Boolean);
  
        if (uniqueStringKeys.length === 0) {
          console.log('No valid unique keys in batch, skipping');
          continue;
        }
  
        // 3. Process people
        await this.processPeopleBatch(
          batch,
          uniqueStringKeys,
          results,
          tracking,
          apiToken
        );
  
        // 4. Process candidates
        await this.processCandidatesBatch(
          batch,
          jobObject,
          results,
          tracking,
          apiToken
        );
  
        // 5. Process job candidates
        await this.processJobCandidatesBatch(
          batch,
          jobObject,
          jobCandidateInfo.path_position,
          results,
          tracking,
          apiToken
        );
  
        if (i + batchSize < data.length) {
          await delay(1000); // Rate limiting between batches
        }
      }
  

  
    } catch (error) {
      console.error('Error in profile processing:', error);
    }
  
    console.log('Processing complete. Results:', {
      people: results.manyPersonObjects.length,
      candidates: results.manyCandidateObjects.length,
      existingPeople: results.allPersonObjects.length,
      jobCandidates: results.manyJobCandidateObjects.length
    });
  
    return results;
  }
  
  // Helper methods to break down the logic:
  
  private async setupJobCandidateStructure(jobObject: CandidateSourcingTypes.Jobs, apiToken: string) {
    const path_position = JobCandidateUtils.getJobCandidatePathPosition(jobObject.name, jobObject?.arxenaSiteId);
    const jobCandidateObjectName = `${path_position}JobCandidate`;
    
    const objectsNameIdMap = await new CreateMetaDataStructure(this.workspaceQueryService).fetchObjectsNameIdMap(apiToken);
    
    let jobCandidateObjectId = objectsNameIdMap[jobCandidateObjectName];
    
    if (!jobCandidateObjectId) {
      jobCandidateObjectId = await this.createNewJobCandidateObject(jobObject, apiToken);
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
  }
  
  private async processCandidatesBatch(
    batch: CandidateSourcingTypes.UserProfile[],
    jobObject: CandidateSourcingTypes.Jobs,
    results: any,
    tracking: any,
    apiToken: string
  ) {
    const uniqueStringKeys = batch.map(p => p?.unique_key_string).filter(Boolean);
    const candidatesMap = await this.batchCheckExistingCandidates(uniqueStringKeys, jobObject.id, apiToken);
    
    const candidatesToCreate:CandidateSourcingTypes.ArxenaCandidateNode[] = [];
    const candidateKeys:string[] = [];
  
    for (const profile of batch) {
      const key = profile?.unique_key_string;
      if (!key) continue;
  
      const existingCandidate = candidatesMap.get(key);
      const personId = tracking.personIdMap.get(key);
  
      if (personId && !existingCandidate) {
        const { candidateNode } = await processArxCandidate(profile, jobObject);
        candidateNode.peopleId = personId;
        candidatesToCreate.push(candidateNode);
        candidateKeys.push(key);
        results.manyCandidateObjects.push(candidateNode);
      } else if (existingCandidate) {
        tracking.candidateIdMap.set(key, existingCandidate.id);
      }
    }
  
    if (candidatesToCreate.length > 0) {
      const response = await this.createCandidates(candidatesToCreate, apiToken);
      response?.data?.data?.createCandidates?.forEach((candidate, idx) => {
        if (candidate?.id) {
          tracking.candidateIdMap.set(candidateKeys[idx], candidate.id);
        }
      });
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
    const jobCandidatesToCreate:CandidateSourcingTypes.ArxenaJobCandidateNode[] = []
  
    for (const profile of batch) {
      const key = profile?.unique_key_string;
      if (!key) continue;
  
      const personId = tracking.personIdMap.get(key);
      const candidateId = tracking.candidateIdMap.get(key);
  
      if (personId && candidateId) {
        const { jobCandidateNode } = await processArxCandidate(profile, jobObject);
        jobCandidateNode.personId = personId;
        jobCandidateNode.candidateId = candidateId;
        jobCandidateNode.jobId = jobObject.id;
  
        const isDuplicate = results.manyJobCandidateObjects.some(jc => 
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
      const query = await new JobCandidateUtils().generateJobCandidatesMutation(path_position);
      await axiosRequest(JSON.stringify({
        query,
        variables: { data: jobCandidatesToCreate }
      }), apiToken);
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
      console.error('Error in creating candidates', error);
      throw error;
    }
  }

  async checkExistingCandidate(uniqueStringKey: string, jobId: string, apiToken: string): Promise<any> {
    const graphqlQuery = JSON.stringify({
      query: allGraphQLQueries.graphqlQueryToFindCandidateByUniqueKey,
      variables: {
        filter: { 
          uniqueStringKey: { eq: uniqueStringKey },
          jobsId: { eq: jobId }
        }
      }
    });
    const response = await axiosRequest(graphqlQuery, apiToken);
    return response.data?.data?.candidates?.edges[0]?.node;
  }

  async checkExistingJobCandidate(personId: string, candidateId: string, jobId: string, jobObject:any, apiToken: string): Promise<any> {
    const path_position = JobCandidateUtils.getJobCandidatePathPosition(jobObject.name, jobObject?.arxenaSiteId);
    const graphqlQueryStr = JobCandidateUtils.generateFindManyJobCandidatesQuery(path_position);
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
        return allJobCandidates.map((candidate: any) => candidate.id);
      }
    
      // Get the filters
      const filters = currentViewWithCombinedFiltersAndSorts.viewFilters;
    
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
    
      return filteredCandidates.map((candidate: any) => candidate.id);
    }
        
async findManyJobCandidatesWithCursor(path_position: string, apiToken: string): Promise<CandidateSourcingTypes.ArxenaJobCandidateNode[]> {
  const graphqlQueryStr = JobCandidateUtils.generateFindManyJobCandidatesQuery(path_position);
  let cursor = null;
  let hasNextPage = true;
  const allJobCandidates: CandidateSourcingTypes.ArxenaJobCandidateNode[] = [];


  while (hasNextPage) {
    const graphqlQuery = JSON.stringify({
      variables: {
        filter: {},
        orderBy: [{ position: "AscNullsFirst" }],
        after: cursor
      },
      query: graphqlQueryStr
    });

    const response = await axiosRequest(graphqlQuery, apiToken);
    const jobCandidates = response.data?.data?.[`${path_position}JobCandidates`]?.edges || [];
    allJobCandidates.push(...jobCandidates.map(edge => edge.node));
    hasNextPage = response.data?.data?.[`${path_position}JobCandidates`]?.pageInfo?.hasNextPage;
    cursor = response.data?.data?.[`${path_position}JobCandidates`]?.pageInfo?.endCursor;
  }

  return allJobCandidates;
}
// }

async createNewJobCandidateObject(newPositionObj: CandidateSourcingTypes.Jobs, apiToken: string): Promise<string> {
    console.log("Creating new job candidate object structure::", newPositionObj);
    const path_position = JobCandidateUtils.getJobCandidatePathPosition(newPositionObj.name, newPositionObj?.arxenaSiteId);
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
      return responseFromMetadata.data.data.createOneObject.id;
    } catch (error) {
      console.error('Error creating object:', error);
      throw error;
    }
  }

  private extractKeysFromObjects(objects: CandidateSourcingTypes.ArxenaJobCandidateNode): string[] {
    const keys = new Set<string>();
    [objects].forEach(obj => {
      Object.keys(obj).forEach(key => keys.add(key));
    });
    return Array.from(keys);
  }

  async createObjectFieldsAndRelations(
    jobCandidateObjectId: string, 
    jobCandidateObjectName: string, 
    jobCandidateNode: CandidateSourcingTypes.ArxenaJobCandidateNode,
    apiToken: string, 
  ): Promise<void> {
    console.log('Creating fields and relations for Job Candidate object', apiToken);
    const existingFieldsResponse = await new CreateMetaDataStructure(this.workspaceQueryService).fetchAllCurrentObjects(apiToken);
    console.log("This is the existingFieldsResponse:", existingFieldsResponse)
    // const existingFieldsFilteredMappedFields = existingFieldsResponse.data?.data?.objects?.edges
    //   ?.filter(x => x?.node?.id == jobCandidateObjectId)[0]?.node?.fields.edges
    //   .map(x => x.node.name);
    console.log("jobCandidateObjectId:", jobCandidateObjectId);
    const keysFromPersonObjects = this.extractKeysFromObjects(jobCandidateNode);
    console.log("keysFromPersonObjects:", keysFromPersonObjects);
    const existingFieldsFilteredMappedFields = existingFieldsResponse?.data?.objects?.edges?.filter(x => x?.node?.id == jobCandidateObjectId)[0]?.node?.fields?.edges?.map(edge => edge?.node?.name) || []; 
    // const existingFieldsFilteredMappedFields = existingFieldsResponse.data?.data?.objects?.edges?.filter(x => x?.node?.id == jobCandidateObjectId)[0]?.node?.fields.edges.map(x=> x.node.name);
    // console.log("existingFieldsFilteredMappedFields response:", existingFieldsResponse?.data?.objects?.edges?[0].node.fields.edges.map(x=> x.node.name));
      console.log("existingFieldsFilteredMappedFields:", existingFieldsFilteredMappedFields);
      const allFields = [...existingFieldsFilteredMappedFields, ...newFieldsToCreate, ...keysFromPersonObjects];
      console.log("All fields are :", allFields);
      const newFieldsToCreateFiltered = Array.from(new Set(allFields)).filter(key => !existingFieldsFilteredMappedFields.includes(key));
      // const fieldsToCreate = newFieldsToCreateFiltered.filter(key => key !== undefined).map(key => {
      console.log("Ultimately fields to create are :", newFieldsToCreateFiltered.filter((key): key is string => key !== undefined));
      const fieldsToCreate = newFieldsToCreateFiltered.filter((key): key is string => key !== undefined).map(key => {
        const fieldType = key.includes('year') || key.includes('months') || key.includes('lacs') || key.includes('thousands') ? 'NumberField' :
          key.includes('link') || key.includes('profileUrl') ? 'LinkField' :
          key.includes('experienceYears') || key.includes('experienceYears') ? 'NumberField' :
          key.includes('ugGraduationYear') || key.includes('ugGraduationYear') ? 'NumberField' :
          key.includes('pgGraduationYear') || key.includes('pgGraduationYear') ? 'NumberField' :
          key.includes('age') || key.includes('age') ? 'NumberField' :
          key.includes('inferredSalary') || key.includes('inferredSalary') ? 'NumberField' :
          key.includes('experienceYears') || key.includes('experienceYears') ? 'NumberField' :
          // key.includes('inferredYearsExperience') || key.includes('inferredYearsExperience') ? 'NumberField' :
          key.includes('displayPicture') || key.includes('displayPicture') ? 'LinkField' :
          key.includes('multi') ? 'MultiField' : 'TextField';

        return {
          field: new CreateFieldsOnObject()[`create${fieldType}`]({
            label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            name: key,
            objectMetadataId: jobCandidateObjectId,
            description: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          })
        };
    });

    try{
      const existingFieldsResponse = await new CreateMetaDataStructure(this.workspaceQueryService).fetchAllCurrentObjects(apiToken);
      console.log("This is the existing Fields Response:%s", existingFieldsResponse);
      const existingFieldsKeys = existingFieldsResponse?.data?.objects?.edges?.filter(x => x?.node?.id == jobCandidateObjectId)[0]?.node?.fields?.edges?.map(edge => edge?.node?.name) || []; 
      console.log("existingFieldsKeys:", existingFieldsKeys);
      console.log("jobCandidateObjectId:", jobCandidateObjectId);
      const fieldsToSendToCreate  = fieldsToCreate.filter(field => !existingFieldsKeys.includes(field?.field?.name));
      console.log("Fields to send to create:", fieldsToSendToCreate);
      await createFields(fieldsToSendToCreate, apiToken);
    }
    catch(error){
      console.log("Errors have happned in createing the fields: ", error);
    }

  }


}