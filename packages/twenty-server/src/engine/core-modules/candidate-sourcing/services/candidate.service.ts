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

  async processProfilesWithRateLimiting(data: CandidateSourcingTypes.UserProfile[], jobObject: CandidateSourcingTypes.Jobs, apiToken: string): Promise<{ 
    manyPersonObjects: CandidateSourcingTypes.ArxenaPersonNode[];  
    manyCandidateObjects: CandidateSourcingTypes.ArxenaCandidateNode[]; 
    allPersonObjects: allDataObjects.PersonNode[];
    manyJobCandidateObjects: CandidateSourcingTypes.ArxenaJobCandidateNode[] 
  }> {
    console.log("Single Profile:", data[0]);
    console.log('Total number of profiles received:', data.length);
    const manyPersonObjects: CandidateSourcingTypes.ArxenaPersonNode[] = [];
    const allPersonObjects: allDataObjects.PersonNode[] = [];
    const manyCandidateObjects: CandidateSourcingTypes.ArxenaCandidateNode[] = [];
    const manyJobCandidateObjects: CandidateSourcingTypes.ArxenaJobCandidateNode[] = [];

    const batchSize = 25;
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    console.log("Received this jobObj:", jobObject);
    const path_position = JobCandidateUtils.getJobCandidatePathPosition(jobObject.name, jobObject?.arxenaSiteId);
    const jobCandidateObjectName = `${path_position}JobCandidate`;
    console.log('Job candidate object name:', jobCandidateObjectName);
    
    let jobCandidateObjectId;
    const objectsNameIdMap = await new CreateMetaDataStructure(this.workspaceQueryService).fetchObjectsNameIdMap(apiToken);
    try {
      console.log('ObjectsNameIdMap:', objectsNameIdMap);
      console.log('Lets see if jobCandidateObjectName eixsts in :', jobCandidateObjectName);
      if (objectsNameIdMap[jobCandidateObjectName]) {
        console.log('Using existing job candidate object:', jobCandidateObjectName);
        jobCandidateObjectId = objectsNameIdMap[jobCandidateObjectName];
      } else {
        console.log('Creating new job candidate object structure::', jobCandidateObjectName);
        try{
          jobCandidateObjectId = await this.createNewJobCandidateObject(jobObject, apiToken);
          if (jobCandidateObjectId) {
            console.log("Job candidate object created successfully:", jobCandidateObjectId);
            console.log("Creating relations for job candidate object");
            this.createRelationsBasedonObjectMap(jobCandidateObjectId, jobCandidateObjectName, apiToken);
            
          }
        }
        catch(error) {
          console.log("Error in creating new job candidate object:", error);
          const objectsNameIdMap = await new CreateMetaDataStructure(this.workspaceQueryService).fetchObjectsNameIdMap(apiToken);
          jobCandidateObjectId = objectsNameIdMap[jobCandidateObjectName];
        }
      }
      console.log('Job candidate object ID:', jobCandidateObjectId);
    } catch (error) {
      console.log('Error in fetching or creating job candidate object:', error);
    }

    const personIdMap = new Map<string, string>();
    const candidateIdMap = new Map<string, string>();
    let personDetailsMap;
    try{

      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const uniqueStringKeys = batch.map(profile => profile?.unique_key_string).filter(Boolean);
        try {
          personDetailsMap = await this.personService.batchGetPersonDetailsByStringKeys(uniqueStringKeys, apiToken);
        } catch (error) {
          console.log('Error in fetching person details:', error);
        }
        for (const profile of batch) {
          const unique_key_string = profile?.unique_key_string;
          if (unique_key_string) {
            console.log("Unique key string found:", unique_key_string);
            const personObj = personDetailsMap?.get(unique_key_string);
            let personId, candidateId;
            const { personNode, candidateNode, jobCandidateNode } = await processArxCandidate(profile, jobObject);
            try {

              if (!personObj || !personObj?.name) {
          manyPersonObjects.push(personNode);
          const responseForPerson = await this.personService.createPeople([personNode], apiToken);
          personId = responseForPerson?.data?.data?.createPeople[0]?.id;
          console.log("PersonId when not found:", personId);
          personIdMap.set(unique_key_string, personId);
              } else {
          personId = personObj?.id;
          allPersonObjects.push(personObj);
          console.log("PersonId when found:", personId);
          personIdMap.set(unique_key_string, personId);
              }
            } catch (error) {
              console.log('Error in creating or fetching person:', error);
            }
          
            try {
              const existingCandidate = await this.checkExistingCandidate(unique_key_string, jobObject.id, apiToken);
              if (!existingCandidate) {
          candidateNode.peopleId = personId;
          manyCandidateObjects.push(candidateNode);
          const responseForCandidate = await this.createCandidates([candidateNode], apiToken);
          candidateId = responseForCandidate?.data?.data?.createCandidates[0]?.id;
          candidateIdMap.set(unique_key_string, candidateId);
              } else {
          console.log("Candidate already exists:", existingCandidate);
          candidateId = existingCandidate.id;
          candidateIdMap.set(unique_key_string, candidateId);

              }
            } catch (error) {
              console.log('Error in creating or fetching candidate:', error);
            }
        } else{
          console.log("Unique key string not found:", unique_key_string);
        }
        }

        if (i + batchSize < data.length) {
          await delay(1000); // Rate limiting
        }
      }
    }
    catch(error){
      console.log("Error:", error)
    }

    console.log('Many manyPersonObjects objects:', manyPersonObjects.length);
    console.log('Many manyCandidateObjects:', manyCandidateObjects.length);
    console.log('Many manyPersonObjects:', manyPersonObjects.length);
    console.log('Many candidateIdMap:', candidateIdMap);
    console.log('Many personIdMap:', personIdMap);
    // console.log('only the first candidate', manyCandidateObjects[0]);
    const { personNode, candidateNode, jobCandidateNode } = await processArxCandidate(data[0], jobObject);
    console.log('personNode for data 0:', personNode);
    console.log('candidateNode for data 0:', candidateNode);
    console.log('jobCandidateNode for data 0:', jobCandidateNode);
    try{
      if (jobCandidateObjectId){
        await this.createObjectFieldsAndRelations(jobCandidateObjectId, jobCandidateObjectName, jobCandidateNode, apiToken);
      }
      else{
        console.log("There is no job candiate id")
      }
    }
    catch{
      console.log("Error in creating object fields and relations");
    }

    try {
      for (const profile of data) {
        const { personNode, candidateNode, jobCandidateNode } = await processArxCandidate(profile, jobObject);
        const personId = personIdMap.get(profile?.unique_key_string);
        const candidateId = candidateIdMap.get(profile?.unique_key_string);
        console.log("personId:", personId);
        console.log("candidateId:", candidateId);
        console.log("jobObject.id:", jobObject.id);
        if (personId && candidateId) {
          const existingJobCandidate = await this.checkExistingJobCandidate(personId, candidateId, jobObject.id,jobObject, apiToken);
          if (!existingJobCandidate) {
            console.log("Job candidate does not exist:");
            jobCandidateNode.personId = personId;
            jobCandidateNode.candidateId = candidateId;
            jobCandidateNode.jobId = jobObject.id;
            if (!manyJobCandidateObjects.some(jc => jc.personId === jobCandidateNode.personId && jc.candidateId === jobCandidateNode.candidateId && jc.jobId === jobCandidateNode.jobId)) {
              manyJobCandidateObjects.push(jobCandidateNode);
            }
          }
          else{
            console.log("Job candidate already exists:");
          }
        }
      }
    

      console.log("Many manyPersonObjects objects 1:", manyPersonObjects.length);
      // console.log("manyJobCandidateObjects 1:", manyJobCandidateObjects);
      console.log("manyJobCandidateObjects 1:", manyJobCandidateObjects.length);
      if (manyJobCandidateObjects.length > 0) {
      console.log("Sample candidate:", manyJobCandidateObjects[0]);
      
      const graphqlQueryObjForJobCandidates = JSON.stringify({
        query: await new JobCandidateUtils().generateJobCandidatesMutation(JobCandidateUtils.getJobCandidatePathPosition(jobObject.name, jobObject.arxenaSiteId)),
        variables: { data: manyJobCandidateObjects },
      });

      const jobCandidatesResponse = await axiosRequest(graphqlQueryObjForJobCandidates, apiToken);
      console.log('Successfully created job candidate :', jobCandidatesResponse?.data);
      } else {
      console.log('No new job candidate relationships to create');
      }
    } catch (error) {
      console.log('Error in creating job candidate relationships:', error);
    }

    console.log('Many manyPersonObjects objects 2:', manyPersonObjects.length);
    console.log('Many manyCandidateObjects: 2', manyCandidateObjects.length);
    console.log('Many manyPersonObjects: 2', manyPersonObjects.length);
    console.log('Many jobCandidateData: 2', manyJobCandidateObjects.length);
    
    return { 
      manyPersonObjects, 
      manyCandidateObjects, 
      allPersonObjects,
      manyJobCandidateObjects 
    };
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
      // console.log("Field value to be filtered:", filterValue);
      // console.log("Field filterStringValue to be filtered:", filterStringValue);
      // console.log("Field operand to be filtered:", operand);
      // console.log("Field stringValue to be filtered:", stringValue);
    
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