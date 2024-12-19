import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { CreateManyCandidates, CreateManyPeople, graphQltoStartChat,UpdateOneJob , CreateOneJob, graphQltoStopChat, createOneQuestion, graphqlToFindManyJobByArxenaSiteId } from './graphql-queries';
import { FetchAndUpdateCandidatesChatsWhatsapps } from '../arx-chat/services/candidate-engagement/update-chat';
import * as allDataObjects from '../arx-chat/services/data-model-objects';
import * as allGraphQLQueries from '../arx-chat/services/candidate-engagement/graphql-queries-chatbot';
import { axiosRequest , axiosRequestForMetadata} from './utils/utils';
import { processArxCandidate } from './utils/data-transformation-utility';
import * as CandidateSourcingTypes from './types/candidate-sourcing-types';
import axios from 'axios';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';
import {createFields} from 'src/engine/core-modules/workspace-modifications/object-apis/services/field-service'
import {CreateFieldsOnObject} from 'src/engine/core-modules/workspace-modifications/object-apis/data/createFields'
import { createRelations } from '../workspace-modifications/object-apis/services/relation-service';
import { CreateMetaDataStructure } from '../workspace-modifications/object-apis/object-apis-creation';
import {JobCandidateUtils} from './utils/job-candidate-utils';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import { JobService } from './services/job.service';
import { PersonService } from './services/person.service';
import { CandidateService } from './services/candidate.service';
import { ChatService } from './services/chat.service';
import { query } from 'express';
import { Enrichment } from '../workspace-modifications/object-apis/types/types';

@Controller('candidate-sourcing')
export class CandidateSourcingController {
  constructor(
    private readonly jobService: JobService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly personService: PersonService,
    private readonly candidateService: CandidateService,
    private readonly chatService: ChatService
  ) {}


  @Post('process-candidate-chats')
  @UseGuards(JwtAuthGuard)

  async processCandidateChats(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token
      const candidateIds= request.body.candidateIds;
      const currentWorkspaceMemberId = request.body.currentWorkspaceMemberId;

      console.log("going to process chats")
      // await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).processCandidatesChatsGetStatuses( apiToken);
      await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).processCandidatesChatsGetStatuses(apiToken);

      return { status: 'Success' };
    } catch (err) {
      console.error('Error in process:', err);
      return { status: 'Failed', error: err };
    }
  }


  @Post('find-many-enrichments')
  @UseGuards(JwtAuthGuard)
  async findManyEnrichments(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token
    const { filter, limit, orderBy } = request.body;

    try {
      const graphqlQueryObj = JSON.stringify({
        query: `query FindManyCandidateEnrichments($filter: CandidateEnrichmentFilterInput, $orderBy: [CandidateEnrichmentOrderByInput], $lastCursor: String, $limit: Int) {
          candidateEnrichments(
            filter: $filter
            orderBy: $orderBy
            first: $limit
            after: $lastCursor
          ) {
            edges {
              node {
                prompt
                modelName
                createdAt
                fields
                id
                name
                selectedModel
                selectedMetadataFields
              }
              cursor
              __typename
            }
            pageInfo {
              hasNextPage
              startCursor
              endCursor
              __typename
            }
            totalCount
            __typename
          }
        }`,
        variables: { },
      });
      
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log("response.data.data:",response.data)
      return { status: 'Success', data: response.data.data.candidateEnrichments.edges.map((edge: any) => edge.node) };
    } catch (err) {
      console.error('Error in findManyEnrichments:', err);
      return { status: 'Failed', error: err };
    }
  }


  async createOneEnrichment(enrichment: Enrichment, jobObject: any, apiToken: string): Promise<any> {
    const graphqlVariables = {
      input: {
        name: enrichment.modelName,
        modelName: enrichment.modelName,
        prompt: enrichment.prompt,
        selectedModel: enrichment.selectedModel,
        fields: enrichment.fields,
        selectedMetadataFields: enrichment.selectedMetadataFields,
        jobId: jobObject?.id,
      },
    };
    const graphqlQueryObj = JSON.stringify({
      query: `mutation CreateOneCandidateEnrichment($input: CandidateEnrichmentCreateInput!) {
        createCandidateEnrichment(data: $input) {
          id
          name
          position
          createdAt
          updatedAt
        }
      }`,
      variables: graphqlVariables,
    });

    const response = await axiosRequest(graphqlQueryObj, apiToken);
    return response.data;
  }

  @Post('create-enrichments')
  @UseGuards(JwtAuthGuard)
  async createEnrichments(@Req() request: any): Promise<object> {
    try {
      const apiToken = request?.headers?.authorization?.split(' ')[1]; // Assuming Bearer token

      const enrichments = request?.body?.enrichments;
      const objectNameSingular = request?.body?.objectNameSingular;
      const availableSortDefinitions = request?.body?.availableSortDefinitions;
      const availableFilterDefinitions = request?.body?.availableFilterDefinitions;
      const objectRecordId = request?.body?.objectRecordId;
      const selectedRecordIds = request?.body?.selectedRecordIds;

      console.log("objectNameSingular:", objectNameSingular);
      console.log("availableSortDefinitions:", availableSortDefinitions);
      console.log("enrichments:", enrichments);
      console.log("availableFilterDefinitions:", availableFilterDefinitions);
      console.log("objectRecordId:", objectRecordId);
      console.log("selectedRecordIds:", selectedRecordIds);
      
      const path_position = objectNameSingular.replace("JobCandidate", "");
      const jobObject = await this.findJob(path_position, apiToken);
      console.log("Found job:", jobObject);

      for (const enrichment of enrichments) {
        const response = await this.createOneEnrichment(enrichment, jobObject, apiToken);
        console.log('Response from create enrichment:', response);
      }

      console.log("process.env.ENV_NODE::", process.env.ENV_NODE);
      const url = process.env.ENV_NODE === 'production' ? 'https://arxena.com/process_enrichments' : 'http://127.0.0.1:5050/process_enrichments';
      const response = await axios.post(
        url,
        {
          enrichments,
          objectNameSingular,
          availableSortDefinitions,
          availableFilterDefinitions,
          objectRecordId,
          selectedRecordIds
        },
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` } }
      );
      console.log('Response from process enrichments:', response.data);

      return { status: 'Success' };
    } catch (err) {
      console.error('Error in process:', err);
      return { status: 'Failed', error: err };
    }
  }



  // @Post('create-enrichments')
  // @UseGuards(JwtAuthGuard)

  // async createEnrichments(@Req() request: any): Promise<object> {
  //   try {
  //     const apiToken = request?.headers?.authorization?.split(' ')[1]; // Assuming Bearer token

  //     const enrichments = request?.body?.enrichments
  //     const objectNameSingular = request?.body?.objectNameSingular
  //     const availableSortDefinitions = request?.body?.availableSortDefinitions
  //     const availableFilterDefinitions = request?.body?.availableFilterDefinitions
  //     const objectRecordId = request?.body?.objectRecordId
  //     const selectedRecordIds = request?.body?.selectedRecordIds

  //     console.log("objectNameSingular:", objectNameSingular)
  //     console.log("availableSortDefinitions:", availableSortDefinitions)
  //     console.log("enrichments:", enrichments)
  //     console.log("availableFilterDefinitions:", availableFilterDefinitions)
  //     console.log("objectRecordId:", objectRecordId)
  //     console.log("selectedRecordIds:", selectedRecordIds)
      
  //     const path_position = objectNameSingular.replace("JobCandidate", "");
  //     const jobObject = await this.findJob(path_position, apiToken);
  //     console.log("Found job:", jobObject);


  //     for (const enrichment of enrichments) {
  //       const graphqlVariables = {
  //         input: {
  //           id: enrichment.id,
  //           name: enrichment.name,
  //           position: enrichment.position,
  //           prompt: enrichment.prompt,
  //           languageModel: enrichment.languageModel.replaceAll("-","").replaceAll(".",""),
  //           sampleJson: enrichment.columnsToProcess,
  //           fields: enrichment.fields,
  //           jobId: jobObject?.id,
  //         },
  //       };
  //       const graphqlQueryObj = JSON.stringify({
  //         query: `mutation CreateOneCandidateEnrichment($input: CandidateEnrichmentCreateInput!) {
  //           createCandidateEnrichment(data: $input) {
  //             id
  //             name
  //             position
  //             createdAt
  //             updatedAt
  //           }
  //         }`,
  //         variables: graphqlVariables,
  //       });

  //       const response = await axiosRequest(graphqlQueryObj, apiToken);
  //       console.log('Response from create enrichment:', response.data);
  //     }





  //     console.log("process.env.ENV_NODE::", process.env.ENV_NODE)
  //     const url = process.env.ENV_NODE === 'production' ? 'https://arxena.com/process_enrichments' : 'http://127.0.0.1:5050/process_enrichments';
  //     const response = await axios.post(
  //       url,
  //       {
  //         enrichments,
  //         objectNameSingular,
  //         availableSortDefinitions,
  //         availableFilterDefinitions,
  //         objectRecordId,
  //         selectedRecordIds
  //       },
  //       { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` } }
  //     );
  //     console.log('Response from process enrichments:', response.data);

  //     console.log("going to process chats")
  //     // await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).processCandidatesChatsGetStatuses( apiToken);
  //     // await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).processCandidatesChatsGetStatuses(apiToken);

  //     return { status: 'Success' };
  //   } catch (err) {
  //     console.error('Error in process:', err);
  //     return { status: 'Failed', error: err };
  //   }
  // }

  async findJob(path_position: string, apiToken: string): Promise<any> {
    console.log("Going to find job by path_position id:", path_position);
    const variables = {
      filter: { pathPosition: { in: [path_position] } },
      limit: 30,
      orderBy: [{ position: "AscNullsFirst" }],
    };
    const query = graphqlToFindManyJobByArxenaSiteId;
    const data = { query, variables };
    console.log("Data to find job:", data);
    const response = await axiosRequest(JSON.stringify(data), apiToken);
    const job = response.data?.data?.jobs?.edges[0]?.node;
    return job;
  }

  @Post('process-job-candidate-refresh-data')
  @UseGuards(JwtAuthGuard)


  async refreshChats(@Req() request: any): Promise<object>  {
    const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token

    try {
      // const { candidateIds } = body;
      const objectNameSingular= request.body.objectNameSingular;
      console.log("thisi s objectNameSingular:",objectNameSingular)
      const url = process.env.ENV_NODE === 'production' ? 'https://arxena.com/sync_job_candidate' : 'http://127.0.0.1:5050/sync_job_candidate';

      console.log('url:', url);
      const response = await axios.post(
        url,
        { objectNameSingular: objectNameSingular},
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` } },
      );

      // await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).processCandidatesChatsGetStatuses(apiToken);
      return { status: 'Success' };
    } catch (err) {
      console.error('Error in refresh chats:', err);
      return { status: 'Failed', error: err };
    }
  }
  
  

   getJobCandidatePathPosition(jobName: string): string {
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
  
   toCamelCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));
  }
  
  


  @Post('create-job-in-arxena')
  @UseGuards(JwtAuthGuard)
  async createJobInArxena(@Req() req): Promise<any> {
    console.log('going to create job in arxena');
    console.log('going to createprocess.env.ENV_NODE', process.env.ENV_NODE);
    const apiToken = req.headers.authorization.split(' ')[1]; // Assuming Bearer token

    try {
      const url = process.env.ENV_NODE === 'production' ? 'https://arxena.com/create_new_job' : 'http://127.0.0.1:5050/create_new_job';
      console.log('url:', url);
      if (!req?.body?.job_name || !req?.body?.new_job_id) {
        throw new Error('Missing required fields: job_name or new_job_id');
      }
      console.log('job_name:', req.body.job_name);
      console.log('new_job_id:', req.body.new_job_id);
      console.log('id_to_update:', req.body.id_to_update);


      await new Promise(resolve => setTimeout(resolve, 500));

      const graphqlToUpdateJob = JSON.stringify({
        query: UpdateOneJob,
        variables: {
          idToUpdate: req.body.id_to_update,
          input: {
            pathPosition: this.getJobCandidatePathPosition(req?.body?.job_name),
            arxenaSiteId: req.body.new_job_id,
            isActive: true,
          },
        },
      });

      console.log('GraphQL request:', graphqlToUpdateJob);

      const responseToUpdateJob = await axiosRequest(graphqlToUpdateJob, apiToken);
      console.log('Response from update job:', responseToUpdateJob.data);

      const response = await axios.post(
        url,
        { job_name: req.body.job_name, new_job_id: req.body.new_job_id },
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` } },
      );
      console.log('Response from create job', response?.data);
      return response.data.data.createJob;
    } catch (error) {
      console.log('Error in createJobInArxena:', error);
      return { error: error.message };
    }
  }

  @Post('post-candidates')
  @UseGuards(JwtAuthGuard)
  async sourceCandidates(@Req() req) {
    console.log('Called post candidates API');
    const apiToken = req.headers.authorization.split(' ')[1];
  
    const jobId = req.body?.job_id;
    const jobName = req.body?.job_name;
    console.log('arxenaJobId:', jobId);
    const data: CandidateSourcingTypes.UserProfile[] = req.body?.data;
    
    try {
      // Get job details
      const jobObject = await this.jobService.getJobDetails(jobId, jobName, apiToken);
      if (!jobObject) {
        console.log('Job not found');
      }
      console.log("Job Object Found:", jobObject)
      // Process profiles and get all the necessary data
      const { manyPersonObjects, manyCandidateObjects, allPersonObjects, manyJobCandidateObjects } = 
      await this.candidateService.processProfilesWithRateLimiting(data, jobObject, apiToken);
      console.log('Number of new person objects:', manyPersonObjects?.length);
      console.log('Number of existing person objects:', allPersonObjects?.length);
      console.log('Number of new candidate objects:', manyCandidateObjects?.length);
      console.log('Number of new job candidate relationships:', manyJobCandidateObjects?.length);
      // Batch create job candidates if there are any new ones

      return { 
        status: 'success',
        summary: {
          newPeople: manyPersonObjects.length,
          existingPeople: allPersonObjects.length,
          newCandidates: manyCandidateObjects.length,
          newJobCandidates: manyJobCandidateObjects.length
        }
      };
  
    } catch (error) {
      console.error('Error in sourceCandidates:', error);
      return { 
        status: 'error',
        error: error.message,
        details: error.response?.data || error.stack
      };
    }
  }
  
  @Post('get-all-jobs')
  @UseGuards(JwtAuthGuard)

  async getJobs(@Req() request: any) {
    console.log("Going to get all jobs")

    const apiToken = request?.headers?.authorization?.split(' ')[1]; // Assuming Bearer token
    console.log("apitoken:",apiToken)
    console.log('Getting all jobs');
    // first create companies
    console.log('Getting all jobs');
    const responseFromGetAllJobs = await axiosRequest(
      JSON.stringify({
        query: graphqlToFindManyJobByArxenaSiteId,
        variables: {
          limit: 30,
          orderBy: [{ position: 'AscNullsFirst' }],
        }
      }),apiToken
    );
    const jobsObject: CandidateSourcingTypes.Jobs = responseFromGetAllJobs.data?.data?.jobs?.edges;
    return { jobs: jobsObject };
  }



  @Post('test-arxena-connection')
  @UseGuards(JwtAuthGuard)
  async testArxenaConnection(@Req() request: any) {

    console.log("Going to test arxena connections")

    const apiToken = request?.headers?.authorization?.split(' ')[1]; // Assuming Bearer token
    console.log("apitoken:",apiToken)
    // first create companies
    try{
      let arxenaSiteBaseUrl: string = '';
      if (process.env.NODE_ENV === 'development') {
        console.log("process.env.ARXENA_SITE_BASE_URL", process.env.ARXENA_SITE_BASE_URL)
        arxenaSiteBaseUrl = process.env.ARXENA_SITE_BASE_URL || 'http://localhost:5050';
      } else {
        arxenaSiteBaseUrl = process.env.ARXENA_SITE_BASE_URL || 'https://arxena.com';
      }
      console.log("arxenaSiteBaseUrl:",arxenaSiteBaseUrl)
      arxenaSiteBaseUrl = 'http://127.0.0.1:5050'
      const response = await axios.post(arxenaSiteBaseUrl+'/test-connection-from-arx-twenty',  { jobId: 'some-id' },  {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
      });
      console.log('Response from localhost:5050', response.data);
      return { jobs: response.data };
    }
    catch(error){
      console.log("Error in testArxenaConnection",error)
    }
  }





  @Post('post-job')
  @UseGuards(JwtAuthGuard)
  async postJob(@Req() request: any) {
    let uuid;
    try {
      const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token
      console.log("apiToken:")
      const data = request.body;
      console.log(request.body);
      const graphqlVariables = { input: { name: data?.job_name, arxenaSiteId: data?.job_id, isActive: true, jobLocation: data?.jobLocation, jobCode: data?.jobCode, recruiterId: data?.recruiterId, companiesId: data?.companiesId } };
      const graphqlQueryObj = JSON.stringify({ query: CreateOneJob, variables: graphqlVariables });
      const responseNew = await axiosRequest(graphqlQueryObj, apiToken);
      console.log('Response from create job', responseNew.data);
      uuid = responseNew.data.data.createJob.id;
      return { status: 'success', job_uuid: uuid };
    } catch (error) {
      console.log('Error in postJob', error);
      return { error: error.message };
    }
  }

  @Post('add-questions')
  @UseGuards(JwtAuthGuard)
  async addQuestions(@Req() request: any) {
    try {
      // console.log(body);
      const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token
      const data = request.body;
      const arxenaJobId = data?.job_id;
      const jobName = data?.job_name;
      const jobObject:CandidateSourcingTypes.Jobs = await this.jobService.getJobDetails(arxenaJobId,jobName, apiToken, );
      // console.log("getJobDetails:", jobObject);
      const questions = data?.questions || [];
      console.log('Number Questions:', questions?.length);
      for (const question of questions) {
        const graphqlVariables = { input: { name: question, jobsId: jobObject?.id } };
        const graphqlQueryObj = JSON.stringify({ query: createOneQuestion, variables: graphqlVariables });
        // console.log("graphqlQueryObj:", graphqlQueryObj);
        const response = await axiosRequest(graphqlQueryObj,apiToken);
        // console.log('Response from adding question:', response.data);
      }
      return { status: 'success' };
    } catch (error) {
      console.log('Error in add questions', error);
      return { error: error.message };
    }
  }


    @Post('start-chats')
  async startChats(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    const jobCandidateIds = request.body.candidateIds;
    const currentViewWithCombinedFiltersAndSorts = request.body.currentViewWithCombinedFiltersAndSorts;
    const objectNameSingular = request.body.objectNameSingular;
    console.log("jobCandidateIds::", jobCandidateIds);
    console.log("objectNameSingular::", objectNameSingular);
    console.log("currentViewWithCombinedFiltersAndSorts::", currentViewWithCombinedFiltersAndSorts);
    const path_position = request?.body?.objectNameSingular.replace("JobCandidate", "")
    const allDataObjects = await new CreateMetaDataStructure(this.workspaceQueryService).fetchAllObjects(apiToken);
    
    const allJobCandidates = await this.candidateService.findManyJobCandidatesWithCursor(path_position, apiToken);
    
    const filteredCandidateIds = await this.candidateService.filterCandidatesBasedOnView(allJobCandidates, currentViewWithCombinedFiltersAndSorts,allDataObjects);
    console.log("This is the filteredCandidates, ", filteredCandidateIds)
    console.log("Got a total of filteredCandidates length, ", filteredCandidateIds.length)
    for (const candidateId of filteredCandidateIds) {
      await this.startChatByCandidateId(candidateId, apiToken);
    }
    return { status: 'Success' };
  }


  @Post('start-chat')
  @UseGuards(JwtAuthGuard)
  async startChat(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token
    const response = await this.startChatByCandidateId(request.body.candidateId, apiToken);
    console.log('Response from create startChat', response);
  }
  


  async startChatByCandidateId(candidateId: string, apiToken: string) {
    const graphqlVariables = {
      idToUpdate: candidateId,
      input: {
        startChat: true,
      },
    };
    const graphqlQueryObj = JSON.stringify({
      query: graphQltoStartChat,
      variables: graphqlVariables,
    });

    const response = await axiosRequest(graphqlQueryObj, apiToken);
    return response.data;
  }



  @Post('stop-chat')
  @UseGuards(JwtAuthGuard)
  async stopChat(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token

    const graphqlVariables = {
      idToUpdate: request.body.candidateId,
      input: {
        stopChat: true,
      },
    };
    const graphqlQueryObj = JSON.stringify({
      query: graphQltoStopChat,
      variables: graphqlVariables,
    });

    const response = await axiosRequest(graphqlQueryObj, apiToken);
    console.log('Response from create startChat', response.data);
  }

  @Post('fetch-candidate-by-phone-number-start-chat')
  @UseGuards(JwtAuthGuard)
  async fetchCandidateByPhoneNumber(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token

    console.log('called fetchCandidateByPhoneNumber for phone:', request.body.phoneNumber);
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPhoneNumber(request.body.phoneNumber,apiToken);
    const candidateId = personObj.candidates?.edges[0]?.node?.id;
    const graphqlVariables = {
      idToUpdate: candidateId,
      input: {
        startChat: true,
      },
    };
    const graphqlQueryObj = JSON.stringify({
      query: graphQltoStartChat,
      variables: graphqlVariables,
    });

    const response = await axiosRequest(graphqlQueryObj, apiToken);
    console.log('Response from create startChat::', response.data);
    return response.data;
  }
}
