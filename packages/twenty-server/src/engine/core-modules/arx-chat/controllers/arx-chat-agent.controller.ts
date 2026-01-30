import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import {
  CandidateEdge,
  CandidateNode,
  ChatControlsObjType,
  graphqlMutationToDeleteManyCandidates,
  graphqlMutationToDeleteManyPeople,
  graphqlQueryToFindManyPeople,
  graphqlToCreateOnePrompt,
  graphqlToFetchAllCandidateData,
  graphqlToFetchAllCandidateDataWithFieldValues,
  graphQltoUpdateOneCandidate,
  graphqlToUpdateWhatsappMessageId,
  Job,
  MessageNode,
  mutations,
  PersonEdge,
  PersonNode,
  queries,
  whatappUpdateMessageObjType
} from 'twenty-shared';

import { PageInfo } from 'cloudflare/core';
import { CandidateEngagementArx } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/candidate-engagement';
import { EngagedCandidateQueueService } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/engaged-candidate-queue.service';
import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { HumanLikeLLM } from 'src/engine/core-modules/arx-chat/services/llm-agents/human-or-bot-classification';
import { ToolCallsProcessing } from 'src/engine/core-modules/arx-chat/services/llm-agents/tool-calls-processing';
import { MessagingControls } from 'src/engine/core-modules/arx-chat/services/messaging-controls';
import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import {
  formatChat
} from 'src/engine/core-modules/arx-chat/utils/arx-chat-agent-utils';
import { DeleteFieldValuesService } from 'src/engine/core-modules/candidate-sourcing/jobs/delete-field-values.service';
import { JDUploadService } from 'src/engine/core-modules/candidate-sourcing/services/jd-upload.service';
import { createJobIdErrorResponse, validateAndExtractJobId } from 'src/engine/core-modules/candidate-sourcing/utils/job-id.utils';
import { GoogleSheetsService } from 'src/engine/core-modules/google-sheets/google-sheets.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { prompts } from 'src/engine/core-modules/workspace-modifications/object-apis/data/prompts';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

@Controller('arx-chat')
export class ArxChatEndpoint {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly candidateEngagementArx: CandidateEngagementArx,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly engagedCandidateQueueService: EngagedCandidateQueueService,
    private readonly updateChat: UpdateChat,
    private readonly jdUploadService: JDUploadService,
    private readonly deleteFieldValuesService: DeleteFieldValuesService,
  ) {}

  @Post('start-chat')
  @UseGuards(JwtAuthGuard)
  async startChat(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, ''); // Assuming Bearer token
    const candidateId = request.body.candidateId;
    
    const chatControl: ChatControlsObjType = {
      chatControlType: 'startChat',
    };
    
    // Step 1: Set startChat to true
    const response = await this.candidateEngagementArx.createChatControl(
      candidateId,
      chatControl,
      apiToken
    );

    console.log('Response from create start-Chat api', response);

    // Step 2: Create an incoming message to set engagementStatus to true
    // This simulates the candidate sending a message like "Hi" to start the engagement
    try {
      await this.updateChat.createInterimChatQueue(
        'startChat', // Simple greeting to start the conversation
        candidateId,
        apiToken
      );
      
      console.log('Successfully created interim chat message for candidate', candidateId);
    } catch (error) {
      console.error('Error creating interim chat message:', error);
      // Don't throw here as the main startChat operation was successful
    }

    return { status: 'Success', message: 'Chat started and engagement enabled' };
  }

  @Post('start-chat-queue')
  @UseGuards(JwtAuthGuard)
  async startChatQueue(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, ''); // Assuming Bearer token
    const candidateId = request.body.candidateId;
    
    // Queue the candidate for engagement processing with all operations moved to worker
    // This includes createChatControl and createInterimChat operations
    try {
      await this.updateChat.createInterimChatQueue(
        'startChat', // Simple greeting to start the conversation
        candidateId,
        apiToken
      );
      
      console.log('Successfully queued candidate for start chat processing', candidateId);
    } catch (error) {
      console.error('Error queuing candidate for start chat processing:', error);
      throw error;
    }

    return { status: 'Success', message: 'Candidate queued for start chat processing' };
  }

  @Post('get-queries-and-mutations')
  async getQueriesAndMutations(): Promise<object> {
    console.log('Getting all queries and mutations');
    const allQueries = {
      queries: queries,
      mutations: mutations,
    };

    return allQueries;
  }



  @Post('search-candidates-sql')
  @UseGuards(JwtAuthGuard)
  async searchCandidates(
    @Req() request: any,
  ) {
    try {
      console.log('Searching candidates with SQL'); 
      const startTime = performance.now();
      let lastStepTime = startTime;
      const timings: Record<string, number> = {};
      
      // Step 1: Extract data from request
      // -------------------------------
      // Extract data from request
      const body = request.body;
      const token = request.headers.authorization.split(' ')[1].replace(/\r|\n/g, '');
      const payload = await this.workspaceQueryService.getWorkspaceIdFromToken(token);
      timings['extract_and_token'] = performance.now() - lastStepTime;
      lastStepTime = performance.now();
      console.log('[Perf] Step 1 (extract/token):', timings['extract_and_token'].toFixed(2), 'ms');
      
      // Validate required parameters
      if (!body.filter?.jobsId?.in || !Array.isArray(body.filter.jobsId.in)) {
        throw new HttpException('Invalid jobsId filter', HttpStatus.BAD_REQUEST);
      }
      if (!body.limit || typeof body.limit !== 'number') {
        throw new HttpException('Invalid limit parameter', HttpStatus.BAD_REQUEST);
      }
      timings['validate_params'] = performance.now() - lastStepTime;
      lastStepTime = performance.now();
      console.log('[Perf] Step 2 (validate params):', timings['validate_params'].toFixed(2), 'ms');
      
      // Step 2: Get the schema name for this workspace
      const dataSourceSchema = this.workspaceQueryService.getDataSourceSchema(payload);
      timings['get_schema'] = performance.now() - lastStepTime;
      lastStepTime = performance.now();
      console.log('[Perf] Step 3 (get schema):', timings['get_schema'].toFixed(2), 'ms');
      
      // Step 3: Test if tables exist and get column information
      // try {
      //   const testQuery = `SELECT table_name FROM information_schema.tables WHERE table_schema = '${dataSourceSchema}' AND table_name IN ('_candidate', '_candidateFieldValue', '_candidateField')`;
      //   const tableCheck = await this.workspaceQueryService.executeRawQuery(testQuery, [], payload);
      //   console.log('Available tables in schema:', tableCheck.map(t => t.table_name));
        
      //   // Get column information for _candidate table
      //   const columnQuery = `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = '${dataSourceSchema}' AND table_name = '_candidate' ORDER BY ordinal_position`;
      //   const columnCheck = await this.workspaceQueryService.executeRawQuery(columnQuery, [], payload);
      //   console.log('Available columns in _candidate table:', columnCheck.map(c => `${c.column_name} (${c.data_type})`));
      // } catch (error) {
      //   console.error('Error checking tables:', error);
      // }
      
      timings['check_tables_columns'] = performance.now() - lastStepTime;
      lastStepTime = performance.now();
      console.log('[Perf] Step 4 (check tables/columns):', timings['check_tables_columns'].toFixed(2), 'ms');
      
      // Step 4: Raw SQL with all the joins you need
      const sql = `
        SELECT 
          c.id,
          c.name,
          c."updatedAt",
          c."createdAt",
          c."status",
          c."jobTitle",
          c."whatsappProvider",
          -- c."phoneNumber"::json,
          -- c."email"::json,
          c."candConversationStatus",
          c."peopleId",
          c."startVideoInterviewChat",
          c.source,
          c.campaign,
          c."jobsId",
          c."jobTitle",
          c.remarks,
          c."messagingChannel",
          c."engagementStatus",
          c."lastEngagementChatControl",
          c."startVideoInterviewChat",
          c."startMeetingSchedulingChat",
          c."stopChat",
          c."uniqueStringKey",
          -- c."hiringNaukriUrl"::json,
          -- c."resdexNaukriUrl"::json,
          -- c."linkedinUrl"::json,
          c."startChat",
          c."chatCount",
          c."startChatCompleted",
          c."startMeetingSchedulingChatCompleted",
          c."startVideoInterviewChatCompleted",
          
          -- Aggregate candidate field values as JSON
          COALESCE(
            JSON_AGG(
              CASE 
                WHEN cfv.id IS NOT NULL THEN
                  JSON_BUILD_OBJECT(
                    'id', cfv.id,
                    'name', cfv.name,
                    'candidateFields', JSON_BUILD_OBJECT(
                      'name', cf.name,
                      'id', cf.id
                    )
                  )
                ELSE NULL
              END
            ) FILTER (WHERE cfv.id IS NOT NULL), 
            '[]'::json
          ) as candidate_field_values,

          -- Aggregate WhatsApp messages as JSON
          COALESCE(
            JSON_AGG(
              CASE 
                WHEN wm.id IS NOT NULL THEN
                  JSON_BUILD_OBJECT(
                    'updatedAt', wm."updatedAt",
                    'messageObj', wm."messageObj",
                    'createdAt', wm."createdAt",
                    'whatsappDeliveryStatus', wm."whatsappDeliveryStatus",
                    'id', wm.id,
                    'name', wm.name,
                    'recruiterId', wm."recruiterId",
                    'message', wm.message,
                    'candidateId', wm."candidateId",
                    'jobsId', wm."jobsId",
                    'position', wm.position,
                    'phoneTo', wm."phoneTo",
                    'phoneFrom', wm."phoneFrom"
                  )
                ELSE NULL
              END
            ) FILTER (WHERE wm.id IS NOT NULL), 
            '[]'::json
          ) as whatsappMessages

        FROM ${dataSourceSchema}."_candidate" c
        LEFT JOIN ${dataSourceSchema}."_candidateFieldValue" cfv ON c.id = cfv."candidateId"
        LEFT JOIN ${dataSourceSchema}."_candidateField" cf ON cfv."candidateFieldsId" = cf.id
        LEFT JOIN ${dataSourceSchema}."_whatsappMessage" wm ON c.id = wm."candidateId"
        
        WHERE c."deletedAt" IS NULL
          AND c."stopChat" = false
          AND c."startChat" = true
          AND c."startVideoInterviewChatCompleted" IS NULL
          AND c."jobsId" = ANY($1)
          ${body.lastCursor ? 'AND c."updatedAt" < $3' : ''}
        
        GROUP BY c.id
        ORDER BY c."updatedAt" DESC
        LIMIT $2
      `;

      // Check if we should fetch all pages
      const shouldFetchAllPages = body.fetchAllPages === true;
      let allResults: any[] = [];
      let currentCursor = body.lastCursor;
      let hasMorePages = true;
      let pageCount = 0;
      const maxPages = body.maxPages || 100; // Safety limit

      while (hasMorePages && pageCount < maxPages) {
        const params = [
          body.filter.jobsId.in, // Array of job IDs
          body.limit,
          ...(currentCursor ? [new Date(currentCursor)] : [])
        ];
        
        console.log(`[Perf] Executing page ${pageCount + 1}, cursor: ${currentCursor || 'none'}`);
        console.log('Params for SQL', params);
        console.log('SQL Query:', sql);

        let result;
        let totalTime;
        let sqlStart = performance.now();
        let connectionStart = performance.now();
        try {

          console.log('[Perf] About to execute SQL query...');
          const connectionAcquisitionStart = performance.now();
          console.log('[Perf] About to execute SQL query with connection pooling...');
          result = await this.workspaceQueryService.executeRawQuery(sql, params, payload);
          const connectionAcquisitionTime = performance.now() - connectionAcquisitionStart;
          
          timings['sql_query'] = performance.now() - sqlStart;
          lastStepTime = performance.now();
          console.log('[Perf] Step 5 (SQL query):', timings['sql_query'].toFixed(2), 'ms');
          console.log('[Perf] Connection acquisition time:', connectionAcquisitionTime.toFixed(2), 'ms');
          console.log('[Perf] SQL query result size:', JSON.stringify(result).length, 'bytes');
          console.log('[Perf] SQL query result rows:', result.length);
          
          // Calculate the actual query execution time (excluding connection overhead)
          const actualQueryTime = timings['sql_query'] - connectionAcquisitionTime;
          console.log('[Perf] Actual query execution time (excluding connection):', actualQueryTime.toFixed(2), 'ms');
          
          // Log connection pool status if possible
          console.log('[Perf] Connection pool diagnostics - this query took:', connectionAcquisitionTime.toFixed(2), 'ms');
          
          totalTime = performance.now() - startTime;
          console.log(`Raw SQL executed in ${totalTime.toFixed(2)}ms`);
          console.log('Query result count:', result.length);
        } catch (error) {
          console.error('SQL Query Error:', error);
          console.error('SQL Query:', sql);
          console.error('SQL Params:', params);
          throw error;
        }

        // Add results to allResults
        allResults = allResults.concat(result);
        
        // Check if there are more pages
        hasMorePages = result.length === body.limit;
        if (hasMorePages && result.length > 0) {
          currentCursor = result[result.length - 1].updatedAt.toISOString();
        }
        
        pageCount++;
        console.log(`[Perf] Page ${pageCount} completed. Total results so far: ${allResults.length}`);
      }

      console.log(`[Perf] Fetched ${pageCount} pages with ${allResults.length} total results`);
      const result = allResults;
      const totalTime = performance.now() - startTime;
      
      // Step 5: Transform to match your expected format
      const transformStart = performance.now();
      const edges = result.map(row => ({
        cursor: row.updatedAt.toISOString(),
        node: {
          id: row.id,
          name: row.name,
          updatedAt: row.updatedAt,
          createdAt: row.createdAt,
          status: row.status,
          jobTitle: row.jobTitle,
          whatsappProvider: row.whatsappProvider,
          phoneNumber: row.phone_number || { primaryPhoneNumber: '' },
          email: row.email || { primaryEmail: '' },
          candConversationStatus: row.candConversationStatus,
          peopleId: row.peopleId,
          source: row.source,
          campaign: row.campaign,
          jobsId: row.jobsId,
          remarks: row.remarks,
          messagingChannel: row.messagingChannel,
          engagementStatus: row.engagementStatus,
          lastEngagementChatControl: row.lastEngagementChatControl,
          startVideoInterviewChat: row.startVideoInterviewChat,
          startMeetingSchedulingChat: row.startMeetingSchedulingChat,
          stopChat: row.stopChat,
          uniqueStringKey: row.uniqueStringKey,
          hiringNaukriUrl: row.hiring_naukri_url || { primaryLinkUrl: '', primaryLinkLabel: '' },
          resdexNaukriUrl: row.resdex_naukri_url || { primaryLinkUrl: '', primaryLinkLabel: '' },
          linkedinUrl: row.linkedin_url || { primaryLinkUrl: '', primaryLinkLabel: '' },
          candidateFieldValues: {
            edges: row.candidate_field_values.map(cfv => ({
              node: cfv
            }))
          },
          whatsappMessages: {
            edges: row.whatsapp_messages.map(wm => ({
              node: wm
            }))
          },
          startChat: row.startChat,
          chatCount: row.chatCount,
          startChatCompleted: row.startChatCompleted,
          startMeetingSchedulingChatCompleted: row.startMeetingSchedulingChatCompleted,
          startVideoInterviewChatCompleted: row.startVideoInterviewChatCompleted
        }
      }));
      const pageInfo = {
        hasNextPage: shouldFetchAllPages ? false : result.length === body.limit,
        endCursor: result.length > 0 ? result[result.length - 1].updatedAt.toISOString() : null
      };
      timings['transform'] = performance.now() - transformStart;
      lastStepTime = performance.now();
      console.log('[Perf] Step 6 (transform):', timings['transform'].toFixed(2), 'ms');
      
      // Final summary
      const totalElapsed = performance.now() - startTime;
      console.log('[Perf] search Candidates timings:', {
        ...timings,
        total: totalElapsed.toFixed(2)
      });

      // Add timing for response creation
      const responseStart = performance.now();
      const response = {
        data: {
          candidates: {
            edges,
            pageInfo
          }
        },
        executionTime: totalTime
      };
      
      // Test JSON serialization time
      const jsonStart = performance.now();
      const jsonString = JSON.stringify(response);
      const jsonTime = performance.now() - jsonStart;
      console.log('[Perf] JSON serialization time:', jsonTime.toFixed(2), 'ms');
      console.log('[Perf] Response JSON size:', jsonString.length, 'bytes');
      
      const responseTime = performance.now() - responseStart;
      console.log('[Perf] Response creation time:', responseTime.toFixed(2), 'ms');

      return response;
    } catch (error) {
      console.error('Error in search Candidates:', error);
      throw new HttpException(
        error.message || 'Failed to search candidates',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }



  @Post('get-candidates-graphql-queries-execution-service')
  async getCandidatesGraphQLQueriesExecutionService(@Req() request: any): Promise<object> {
    console.log('Getting all queries and mutations');
    const graphqlVariables = {
      // lastCursor: request.body.lastCursor,
      // limit: request.body.limit,
      // filter: request.body.filter,
    };
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const response = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateDataWithFieldValues, graphqlVariables, apiToken);
    console.log('Response from getCandidatesGraphQLQueriesExecutionService', response);
    return response;
  }

  // @Post('start-chats-by-job-candidate-ids')
  // async startChatsByJobCandidateIds(@Req() request: any): Promise<object> {
  //   const apiToken = request.headers.authorization.split(' ')[1];
  //   const jobCandidateIds = request.body.jobCandidateIds;
  //   const currentViewWithCombinedFiltersAndSorts = request.body.currentViewWithCombinedFiltersAndSorts;
  //   const objectNameSingular = request.body.objectNameSingular;
  //   console.log('jobCandidateIds::', jobCandidateIds);
  //   console.log('objectNameSingular::', objectNameSingular);
  //   const path_position = request?.body?.objectNameSingular.replace('JobCandidate', '');
  //   const allDataObjects = await new CreateMetaDataStructure(this.workspaceQueryService).fetchAllObjects(apiToken);

  //   const allJobCandidates = await this.candidateService.findManyJobCandidatesWithCursor(path_position, apiToken);
  //   console.log('All Job Candidates:', allJobCandidates?.length);
  //   const filteredCandidateIds = await this.candidateService.filterCandidatesBasedOnView(allJobCandidates, currentViewWithCombinedFiltersAndSorts, allDataObjects);
  //   console.log('This is the filteredCandidates, ', filteredCandidateIds);
  //   console.log('Got a total of filteredCandidates length, ', filteredCandidateIds.length);
  //   console.log('Starting chat for , ', filteredCandidateIds.length, ' candidates');
  //   for (const candidateId of filteredCandidateIds) {
  //     const chatControl: ChatControlsObjType = { chatControlType: 'startChat' };
  //     await await new CandidateEngagementArx(this.workspaceQueryService).createChatControl(candidateId, chatControl, apiToken);
  //   }
  //   return { status: 'Success' };
  // }

  @Post('start-chats-by-candidate-ids')
  async startChatsByCandidateIds(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const candidateIds = request.body.candidateIds;
    console.log('candidateIds', candidateIds);
    console.log('Number of candidate Ids to start chats', candidateIds.length);
    
    // Collect candidate data for Google Contacts creation
    const candidateDataForGoogleContacts: any[] = [];
    let candidateJob: Job | null = null;
    
    for (const candidateId of candidateIds) {
      try {
        // Step 1: Set startChat to true
        const chatControl: ChatControlsObjType = {
          chatControlType: 'startChat',
        };
        await this.candidateEngagementArx.createChatControl(
          candidateId,
          chatControl,
          apiToken
        );

        // Step 2: Create an incoming message to set engagementStatus to true
        await this.updateChat.createInterimChatQueue(
          'startChat', // Simple greeting to start the conversation
          candidateId,
          apiToken
        );
        
        // Step 3: Collect candidate data for Google Contacts (if not already collected)
        if (candidateDataForGoogleContacts.length === 0) {
          try {
            const candidateData = await new FilterCandidates(
              this.workspaceQueryService,
              this.staticGraphQLService,
            ).getCandidateDetailsById(candidateId, apiToken);
            
            if (candidateData) {
              candidateJob = candidateData.jobs;
              candidateDataForGoogleContacts.push(candidateData);
            }
          } catch (error) {
            console.warn(`Failed to fetch candidate data for Google Contacts: ${candidateId}`, error);
          }
        }
        
        console.log('Successfully started chat and engagement for candidate', candidateId);
      } catch (error) {
        console.error(`Error starting chat for candidate ${candidateId}:`, error);
        // Continue with next candidate even if this one fails
      }
    }
    
    // Step 4: Queue candidates for Google Contacts creation
    if (candidateDataForGoogleContacts.length > 0 && candidateJob) {
      try {
        await this.engagedCandidateQueueService.queueCandidatesForGoogleContacts(
          candidateDataForGoogleContacts,
          candidateJob,
          apiToken
        );
        console.log(`Queued ${candidateDataForGoogleContacts.length} candidates for Google Contacts creation`);
      } catch (error) {
        console.error('Failed to queue candidates for Google Contacts creation:', error);
        // Don't fail the entire operation if Google Contacts creation fails
      }
    }
    
    return { status: 'Success', message: `Processed ${candidateIds.length} candidates` };
  }

  @Post('start-chats-queue-by-candidate-ids')
  async startChatsQueueByCandidateIds(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const candidateIds = request.body.candidateIds;
    console.log('candidateIds', candidateIds);
    console.log('Number of candidate Ids to start chats queue', candidateIds.length);
    
    // Collect candidate data for Google Contacts creation
    const candidateDataForGoogleContacts: any[] = [];
    let candidateJob: Job | null = null;
    
    for (const candidateId of candidateIds) {
      try {
        // Queue the candidate for engagement processing with all operations moved to worker
        // This includes createChatControl and createInterimChat operations
        await this.updateChat.createInterimChatQueue(
          'startChat', // Simple greeting to start the conversation
          candidateId,
          apiToken
        );
        
        // Collect candidate data for Google Contacts (if not already collected)
        if (candidateDataForGoogleContacts.length === 0) {
          try {
            const candidateData = await new FilterCandidates(
              this.workspaceQueryService,
              this.staticGraphQLService,
            ).getCandidateDetailsById(candidateId, apiToken);
            
            if (candidateData) {
              candidateJob = candidateData.jobs;
              candidateDataForGoogleContacts.push(candidateData);
            }
          } catch (error) {
            console.warn(`Failed to fetch candidate data for Google Contacts: ${candidateId}`, error);
          }
        }
        
        console.log('Successfully queued chat and engagement for candidate', candidateId);
      } catch (error) {
        console.error(`Error queuing chat for candidate ${candidateId}:`, error);
        // Continue with next candidate even if this one fails
      }
    }
    
    // Queue candidates for Google Contacts creation
    if (candidateDataForGoogleContacts.length > 0 && candidateJob) {
      try {
        await this.engagedCandidateQueueService.queueCandidatesForGoogleContacts(
          candidateDataForGoogleContacts,
          candidateJob,
          apiToken
        );
        console.log(`Queued ${candidateDataForGoogleContacts.length} candidates for Google Contacts creation`);
      } catch (error) {
        console.error('Failed to queue candidates for Google Contacts creation:', error);
        // Don't fail the entire operation if Google Contacts creation fails
      }
    }
    
    return { status: 'Success', message: `Queued ${candidateIds.length} candidates for engagement processing` };
  }

  @Post('stop-chat')
  @UseGuards(JwtAuthGuard)
  async stopChat(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, ''); // Assuming Bearer token

    const graphqlVariables = {
      idToUpdate: request.body.candidateId,
      input: {
        stopChat: true,
      },
    };


    const response = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, graphqlVariables, apiToken);
  }

  @Post('fetch-candidate-by-phone-number-start-chat')
  @UseGuards(JwtAuthGuard)
  async fetchCandidateByPhoneNumber(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, ''); // Assuming Bearer token
    const phoneNumber = request.body.phoneNumber;

    console.log('called fetchCandidateByPhoneNumber for phone:', phoneNumber);
    const personObj : PersonNode | undefined = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
      ).getPersonDetailsByPhoneNumber(phoneNumber, apiToken);
    const candidateId = personObj?.candidates?.edges?.[0]?.node?.id;
    const graphqlVariables = {
      idToUpdate: candidateId,
      input: {
        startChat: true,
      },
    };
    const graphqlQueryObj = JSON.stringify({
      query: graphQltoUpdateOneCandidate,
      variables: graphqlVariables,
    });

    const response = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, graphqlVariables, apiToken);

    console.log(
      'Response from create fetch-candidate-by-phone-number-start::',
      response.data,
    );

    return response.data;
  }

  // @Post('retrieve-chat-response')
  // @UseGuards(JwtAuthGuard)
  // async retrieve(@Req() request: any): Promise<object> {
  //   const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

  //   const personObj: PersonNode | undefined = await new FilterCandidates(
  //     this.workspaceQueryService,
  //     this.staticGraphQLService,
  //       ).getPersonDetailsByPhoneNumber(request.body.phoneNumberFrom, apiToken);

  //   try {
  //     const personCandidateNode = personObj?.candidates?.edges[0]?.node;
  //     const candidateJob = personCandidateNode?.jobs;
  //     // const messagesList = personCandidateNode?.whatsappMessages?.edges;
  //     const messagesList: MessageNode[] = await new FilterCandidates(
  //       this.workspaceQueryService,
  //       this.staticGraphQLService,
  //     ).fetchAllWhatsappMessages(personCandidateNode?.id as string, apiToken);
  //     let mostRecentMessageArr: ChatHistoryItem[] = new FilterCandidates(
  //       this.workspaceQueryService,
  //       this.staticGraphQLService,
  //     ).getMostRecentMessageFromMessagesList(messagesList);
  //     const isChatEnabled = false;

  //     if (mostRecentMessageArr?.length > 0) {
  //       const chatAgent: OpenAIArxMultiStepClient =
  //         new OpenAIArxMultiStepClient(personObj as PersonNode, this.workspaceQueryService, this.staticGraphQLService);
  //       const chatControl: ChatControlsObjType = {
  //         chatControlType: 'startChat',
  //       };

  //       mostRecentMessageArr =
  //         (await chatAgent.createCompletion(
  //           mostRecentMessageArr,
  //           candidateJob as Job,
  //           chatControl,
  //           apiToken,
  //           isChatEnabled,
  //         )) || [];

  //       return mostRecentMessageArr;
  //     }
  //   } catch (err) {
  //     return { status: err };
  //   }

  //   return { status: 'Failed' };
  // }

  @Post('start-interim-chat-prompt')
  @UseGuards(JwtAuthGuard)
  async startInterimChat(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, ''); // Assuming Bearer token
    const interimChat = request.body.interimChat;
    const candidateId = request.body.candidateId;

    console.log('called interimChat:', interimChat);
    await this.updateChat.createInterimChatQueue(
      interimChat,
      candidateId,
      apiToken,
    );

    return;
  }
  @Post('reset-messages-from-whatsapp')
  @UseGuards(JwtAuthGuard)
  async resetMessagesFromWhatsapp(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, ''); // Assuming Bearer token
    const candidateIds = request.body.candidateIds;

    console.log('called resetMessagesFromWhatsapp:', candidateIds);
    for (const candidateId of candidateIds) {
    await this.updateChat.resetMessagesFromWhatsapp(
      candidateId,
      apiToken,
    ); 

    const graphqlVariablesStopChat = {
      idToUpdate: candidateId,
      input: {
        startChat: true,
        engagementStatus: false,
      },
    };
    const responseStopChat = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, graphqlVariablesStopChat, apiToken);

    const graphqlVariablesStartChat = {
      idToUpdate: candidateId,
      input: {
        startChat: true,
        engagementStatus: false,
      },
    };
    const responseStartChat = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, graphqlVariablesStartChat, apiToken);
    }


    return;
  }

  @Post('send-chat')
  @UseGuards(JwtAuthGuard)
  async SendChat(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

    const messageToSend = request?.body?.messageToSend;
    const phoneNumber = request.body.phoneNumberTo;

    const personObj: PersonNode | undefined = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getPersonDetailsByPhoneNumber(phoneNumber, apiToken);

    console.log('This is the chat reply:', messageToSend);
    const candidateJob: Job | undefined = personObj?.candidates?.edges[0]?.node?.jobs;
    const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(
      candidateJob as Job,
      apiToken,
    );

    console.log('Recruiter profile', recruiterProfile);
    const chatMessages =
      personObj?.candidates?.edges.filter(
        (candidate) => candidate.node.jobs.id == candidateJob?.id,
      )[0]?.node?.whatsappMessages?.edges;
    let chatHistory = chatMessages?.[0]?.node?.messageObj || [];
    const chatControl: ChatControlsObjType = {
      chatControlType: 'startChat',
    };
    chatHistory =
      personObj?.candidates?.edges.filter(
        (candidate) => candidate.node.jobs.id == candidateJob?.id,
      )[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj;
    let messageTo:string = personObj?.phones?.primaryPhoneNumber?.length == 10
      ? '91' + personObj?.phones?.primaryPhoneNumber
    : personObj?.phones?.primaryPhoneNumber || '';
    if (personObj?.candidates?.edges[0]?.node?.messagingChannel == 'linkedin') {
      messageTo = personObj?.linkedinLink?.primaryLinkUrl || '';
    }
    else{
      messageTo = personObj?.phones?.primaryPhoneNumber?.length == 10
          ? '91' + personObj?.phones?.primaryPhoneNumber
          : personObj?.phones?.primaryPhoneNumber || '';
    }
    console.log("This is the messaging channel ::", personObj?.candidates?.edges.filter(
      (candidate) => candidate.node.jobs.id == candidateJob?.id,
    )[0]?.node.messagingChannel)
    console.log("This is the whatsapp provider ::", personObj?.candidates?.edges.filter(
      (candidate) => candidate.node.jobs.id == candidateJob?.id,
    )[0]?.node.whatsappProvider)
      
    const whatappUpdateMessageObj: whatappUpdateMessageObjType = {
      id: uuidv4(),
      candidateProfile: personObj?.candidates?.edges?.filter(
        (candidate) => candidate.node.jobs.id == candidateJob?.id,
      )[0]?.node as CandidateNode,
      candidateFirstName: personObj?.name?.firstName || '',
      phoneNumberFrom: recruiterProfile.phoneNumber,
      whatsappMessageType:
        personObj?.candidates?.edges.filter(
          (candidate) => candidate.node.jobs.id == candidateJob?.id,
        )[0]?.node.whatsappProvider ||
        'application03',
      phoneNumberTo: messageTo,
      messages: [{ content: request?.body?.messageToSend }],
      messageType: 'recruiterMessage',
      messageObj: chatHistory,
      lastEngagementChatControl: chatControl.chatControlType,
      whatsappDeliveryStatus: 'created',
      whatsappMessageId: 'startChat',
      typeOfMessage: personObj?.candidates?.edges.filter(
        (candidate) => candidate.node.jobs.id == candidateJob?.id,
      )[0]?.node.messagingChannel || process.env.DEFAULT_WHATSAPP_CLIENT || 'baileys',
    };

    // Use MessagingControls to send the message (handles all messaging channels)
    const candidateNode = personObj?.candidates?.edges?.filter(
      (candidate) => candidate.node.jobs.id == candidateJob?.id,
    )[0]?.node as CandidateNode;
    
    const candidateChatHistory = candidateNode?.whatsappMessages?.edges[0]?.node?.messageObj || [];
    const candidateChatControl: ChatControlsObjType = {
      chatControlType: 'startChat',
    };

    // Create a simple message object for MessagingControls
    const whatappUpdateMessageObjForSending: whatappUpdateMessageObjType = {
      id: uuidv4(),
      candidateProfile: candidateNode,
      candidateFirstName: personObj?.name?.firstName || '',
      phoneNumberFrom: recruiterProfile.phoneNumber,
      whatsappMessageType: candidateNode?.whatsappProvider || 'application03',
      phoneNumberTo: messageTo,
      messages: [{ content: messageToSend }],
      messageType: 'botMessage',
      messageObj: candidateChatHistory,
      lastEngagementChatControl: candidateChatControl.chatControlType,
      whatsappDeliveryStatus: 'created',
      whatsappMessageId: 'startChat',
      typeOfMessage: candidateNode?.messagingChannel || process.env.DEFAULT_WHATSAPP_CLIENT || 'baileys',
    };

    // Use MessagingControls to send the message
    const sendResult = await new MessagingControls(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).sendWhatsappMessage(
      whatappUpdateMessageObjForSending,
      candidateNode,
      candidateJob as Job,
      candidateChatHistory,
      candidateChatControl,
      apiToken,
    );

    if (sendResult.status === 'failed') {
      return { status: 'failed', message: sendResult.message || 'Failed to send message' };
    }

    return { status: 'success' };
  }

  @Post('get-all-messages-by-candidate-id')
  @UseGuards(JwtAuthGuard)
  async getWhatsappMessagessByCandidateId(
    @Req() request: any,
  ): Promise<object[]> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const candidateId = request.body.candidateId;
    const allWhatsappMessages = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).fetchAllWhatsappMessages(candidateId, apiToken);

    return allWhatsappMessages;
  }

  @Post('get-all-messages-by-phone-number')
  @UseGuards(JwtAuthGuard)
  async getAllMessagesByPhoneNumber(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

    console.log(
      'Going to get all messages by phone Number for :',
      request.body.phoneNumber,
    );
    const personObj: PersonNode | undefined = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getPersonDetailsByPhoneNumber(request.body.phoneNumber, apiToken);
    const candidateId: string | undefined = personObj?.candidates?.edges[0]?.node?.id;
    const allWhatsappMessages: MessageNode[] = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).fetchAllWhatsappMessages(candidateId as string, apiToken);
    const formattedMessages = await formatChat(allWhatsappMessages);

    console.log(
      'All messages length:',
      allWhatsappMessages?.length,
      'for phone number:',
      request.body.phoneNumber,
    );

    return { formattedMessages: formattedMessages };
  }

  @Post('get-candidate-status-by-phone-number')
  @UseGuards(JwtAuthGuard)
  async getCandidateStatusByPhoneNumber(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

    console.log(
      'Going to get candidate status by phone Number for :',
      request.body.phoneNumber,
    );
    const personObj: PersonNode | undefined = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getPersonDetailsByPhoneNumber(request.body.phoneNumber, apiToken);
    const candidateStatus =
      personObj?.candidates?.edges[0]?.node?.status || 'Unknown';

    console.log(
      'Candidate satus:',
      candidateStatus,
      'for phone number:',
      request.body.phoneNumber,
    );

    return { status: candidateStatus };
  }

  @Post('get-candidate-by-phone-number')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdsByPhoneNumbers(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

    console.log(
      'Going to get candidate by phone Number for :',
      request.body.phoneNumber,
    );
    const personObj: PersonNode | undefined = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getPersonDetailsByPhoneNumber(request.body.phoneNumber, apiToken);
    const candidateId: string | undefined  = personObj?.candidates?.edges[0]?.node?.id;

    console.log(
      'candidateId to fetch all candidateby phonenumber:',
      candidateId,
    );

    return { candidateId: candidateId as string };
  }

  @Post('get-candidate-id-by-hiring-naukri-url')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdsByHiringNaukriURL(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

      console.log(
        'Going to get candidate by hiring-naukri-url :',
        request?.body?.hiringNaukriUrl,
      );
      const hiringNaukriUrl = request.body.hiringNaukriUrl;
      const graphqlQueryObj = JSON.stringify({
        query: graphqlToFetchAllCandidateData,
        variables: {
          filter: { hiringNaukriUrl: { url: { eq: hiringNaukriUrl } } },
        },
      });
      const response = await this.staticGraphQLService.executeGraphQL(graphqlQueryObj, {
        filter: { hiringNaukriUrl: { url: { eq: hiringNaukriUrl } } },
      }, apiToken);

      const candidates = response?.data?.data?.candidates as { 
        edges: CandidateEdge[];
        pageInfo: PageInfo;
      } | undefined;
  

      const candidateObj = candidates?.edges[0]?.node;

      console.log('Fetched candidate by candidate OB:', candidateObj);
      const candidateId = candidateObj?.id;

      console.log(
        'candidateId to fetch all candidateby hiring-naukri:',
        candidateId,
      );

      return { candidateId };
    } catch (err) {
      console.log('Error in fetching candidate by hiring-naukri-url :', err);

      return { candidateId: null };
    }
  }

  @Post('get-candidate-id-by-resdex-naukri-url')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdsByResdexNaukriURL(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

      console.log(
        'Going to get candidate esdex-naukri-ur :',
        request.body.resdexNaukriUrl,
      );
      const resdexNaukriUrl = request.body.resdexNaukriUrl;
      const graphqlQueryObj = JSON.stringify({
        query: graphqlToFetchAllCandidateData,
        variables: {
          filter: { resdexNaukriUrl: { url: { eq: resdexNaukriUrl } } },
        },
      });

      const response = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, {
        filter: { resdexNaukriUrl: { url: { eq: resdexNaukriUrl } } },
      }, apiToken);

      const candidates = response?.data?.data?.candidates as { 
        edges: CandidateEdge[];
        pageInfo: PageInfo;
      } | undefined;

      const candidateObj = candidates?.edges[0]?.node;

      const candidateId = candidateObj?.id;

      console.log(
        'candidateId to fetch all candidateby resdex-naukri:',
        candidateId,
      );

      return { candidateId };
    } catch (err) {
      console.log('Error in fetching candidate by resdex-naukri-url:', err);

      return { candidateId: null };
    }
  }

  @Post('get-ids-by-unique-string-key')
  @UseGuards(JwtAuthGuard)
  async getIdsByUniqueStringKey(
    @Req() request: any,
  ): Promise<{ candidateIds: string[], personId: string | undefined }> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

      const graphqlQuery = JSON.stringify({
        query: graphqlQueryToFindManyPeople,
        variables: {
          filter: { uniqueStringKey: { eq: request.body.uniqueStringKey } },
        },
      });

      const response = await this.staticGraphQLService.executeGraphQL(graphqlQueryToFindManyPeople, {
        filter: { uniqueStringKey: { eq: request.body.uniqueStringKey } },
      }, apiToken);


      const people = response?.data?.data?.people as { 
        edges: PersonEdge[];
        pageInfo: PageInfo;
      } | undefined;

      const candidateIds = people?.edges[0]?.node?.candidates?.edges
        .map((edge: any) => edge.node?.id)
        .filter((id: string) => id) || [];

      return { candidateIds, personId: people?.edges[0]?.node?.id };
    } catch (err) {
      console.error('Error in getIdsByUniqueStringKey:', err);
      return { candidateIds: [], personId: undefined };
    }
  }

  @Post('refresh-chat-status-by-candidates')
  @UseGuards(JwtAuthGuard)
  async countChats(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const { candidateIds } = request.body;

      console.log('going to refresh chats');
      console.log('Fetching job IDs for candidates:', candidateIds);

      const jobIds = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).getJobIdsFromCandidateIds(candidateIds, apiToken);
      const results = await this.updateChat.processCandidatesChatsGetStatuses(apiToken, jobIds, candidateIds, "countChats");

      console.log(
        'Have received results and will try and update the sheets also from the controlelr',
      );
      await new GoogleSheetsService(
        this.staticGraphQLService,
      ).updateGoogleSheetsWithChatData(
        results,
        apiToken,
      );

      return { status: 'Success' };
    } catch (err) {
      console.error('Error in countChats:', err);

      return { status: 'Failed', error: err };
    }
  }

  @Post('refresh-chat-counts-by-candidates')
  @UseGuards(JwtAuthGuard)
  async refreshChats(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

    try {
      const { candidateIds } = request.body;

      console.log('going to refresh chat counts by candidate Ids');
      await this.updateChat.updateCandidatesWithChatCount(candidateIds, apiToken);

      return { status: 'Success' };
    } catch (err) {
      console.error('Error in refresh-chat-counts-by-candi chats:', err);

      return { status: 'Failed', error: err };
    }
  }

  @Post('test-arxena-connection')
  @UseGuards(JwtAuthGuard)
  async testArxenaConnection(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

      console.log('going to test arxena connection');
      await this.updateChat.testArxenaConnection(
        apiToken,
      );
      console.log(
        'This is the response in create testArxenaConnection testArxenaConnection',
      );

      return { status: 'Success' };
    } catch (err) {
      console.error('Error in testArxenaConnection chats:', err);

      return { status: 'Failed', error: err };
    }
  }



  @Post('get-id-by-naukri-url')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdByNaukriURL(
    @Req() request: any,
  ): Promise<{ candidateId: string | null }> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

    try {
      const url =
        request.body[
          request.body.resdexNaukriUrl ? 'resdexNaukriUrl' : 'hiringNaukriUrl'
        ];
      const type = request.body.resdexNaukriUrl ? 'resdex' : 'hiring';

      const graphqlQueryObj = JSON.stringify({
        query: graphqlToFetchAllCandidateData,
        variables: {
          filter: {
            [`${type}NaukriUrl`]: { url: { eq: url } },
          },
        },
      });

      const response = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, {
        filter: {
          [`${type}NaukriUrl`]: { url: { eq: url } },
        },
      }, apiToken);

      const candidates = response?.data?.data?.candidates as { 
        edges: CandidateEdge[];
        pageInfo: PageInfo;
      } | undefined;

      const candidateId =
        candidates?.edges[0]?.node?.id || null;

      console.log(`Fetched candidateId for ${type}: ${candidateId}`);

      return { candidateId };
    } catch (err) {
      console.error(
        `Error fetching candidate by ${request.body.resdexNaukriUrl ? 'resdex' : 'hiring'}-naukri-url:`,
        err,
      );

      return { candidateId: null };
    }
  }



  @Post('get-candidates-by-job-id')
  @UseGuards(JwtAuthGuard)
  async getCandidatesByJobId(@Req() request: any): Promise<object> {
    const { jobId } = request.body;
    const jobIdValidation = validateAndExtractJobId(jobId);
    if (!jobIdValidation.isValid) {
      return createJobIdErrorResponse(jobIdValidation.error!);
    }

    const actualJobId = jobIdValidation.jobId!;
    console.log('Using actual jobId:', actualJobId);
    const apiToken = request?.headers?.authorization?.split(' ')[1].replace(/[\r\n]+/g, '');
    const candidates = await this.candidateEngagementArx.fetchAllCandidatesWithAllChatControlsByJobId(actualJobId, apiToken);
    console.log('Number of candidates in getCandidatesByJobId:', candidates.length);
    return candidates;
  }

  @Get('get-person-chat')
  @UseGuards(JwtAuthGuard)
  async getCandidateAndChat(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const candidateId = request.query.candidateId;
    const person: PersonNode | undefined  = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getPersonDetailsByCandidateId(candidateId, apiToken);
    const chatControl: ChatControlsObjType = {
      chatControlType: 'allStartedAndStoppedChats',
    };
    const allPeople: PersonNode[] | undefined = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
      ).fetchAllPeopleByPeopleIds([person?.id as string], apiToken);

    console.log('All people length:', allPeople?.length);

    return allPeople;
  }

  @Post('delete-people-and-candidates-from-candidate-id')
  @UseGuards(JwtAuthGuard)
  async deletePeopleFromCandidateIds(@Req() request: any): Promise<object> {
    console.log("Received request to delete people and candidates from candidate id:", request.body);
    const candidateId = request.body.candidateId;
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

    console.log('candidateId to create video-interview:', candidateId);
    const graphqlQueryObjToFetchCandidate = JSON.stringify({
      query: graphqlToFetchAllCandidateData,
      variables: { filter: { id: { eq: candidateId } } },
    });

    const candidateObjresponse = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, {
      filter: { id: { eq: candidateId } },
    }, apiToken);

    const candidateObj = candidateObjresponse?.data?.data?.candidates as { 
      edges: CandidateEdge[];
      pageInfo: PageInfo;
    } | undefined;

    console.log('candidate objk1:', candidateObj);

    const candidateNode =
      candidateObj?.edges[0]?.node;

    if (!candidateNode) {
      console.log('Candidate not found');

      return { status: 'Failed', message: 'Candidate not found' };
    }
    const personId = candidateNode?.people?.id;

    if (!personId) {
      console.log('Person ID not found');

      return { status: 'Failed', message: 'Person ID not found' };
    }

    const graphqlQueryObj = JSON.stringify({
      query: graphqlMutationToDeleteManyCandidates,
      variables: { filter: { id: { in: [candidateId] } } },
    });

    console.log('Going to try and delete candidate');
    try {
      const response = await this.staticGraphQLService.executeGraphQL(graphqlMutationToDeleteManyCandidates, {
        filter: { id: { in: [candidateId] } },
      }, apiToken);

      console.log('Deleted candidate:', response.data);
    } catch (err) {
      console.log(
        'Error deleting candidate:',
        err.response?.data || err.message,
      );

      return { status: 'Failed', message: 'Error deleting candidate' };
    }
    const graphqlQueryObjToDeletePerson = JSON.stringify({
      query: graphqlMutationToDeleteManyPeople,
      variables: { filter: { id: { in: [personId] } } },
    });

    console.log('Going to try and delete person');
    try {

      const response = await this.staticGraphQLService.executeGraphQL(graphqlMutationToDeleteManyPeople, {
        filter: { id: { in: [personId] } },
      }, apiToken);

      console.log('Deleted person:', response.data);

      return { status: 'Success' };
    } catch (err) {
      console.log('Error deleting person:', err.response?.data || err.message);

      return { status: 'Failed', message: 'Error deleting person' };
    }
  }

  @Post('delete-people-and-candidates-from-person-id')
  @UseGuards(JwtAuthGuard)
  async deletePeopleFromPersonIds(@Req() request: any): Promise<object> {
    const personId = request.body.personId;
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

    console.log('personId to delete:', personId);
    const graphqlQueryObjToFetchPerson = JSON.stringify({
      query: graphqlQueryToFindManyPeople,
      variables: { filter: { id: { eq: personId } } },
    });

    const personresponse = await this.staticGraphQLService.executeGraphQL(graphqlQueryToFindManyPeople, {
      filter: { id: { eq: personId } },
    }, apiToken);
    const personObj = personresponse?.data?.data?.people as { 
      edges: PersonEdge[];
      pageInfo: PageInfo;
    } | undefined;

    console.log('personresponse objk1:', personObj);
    const personNode = personObj?.edges[0]?.node;

    if (!personNode) {
      console.log(
        'Person not found so cant do things in dlete peopel from person ids',
      );

      return { status: 'Failed', message: 'Candidate not found' };
    }
    const candidateId = personNode?.candidates?.edges[0].node.id;

    console.log('personNode:', personNode);
    console.log('candidateId:', candidateId);
    if (!candidateId) {
      console.log('candidateId ID not found');

      return { status: 'Failed', message: 'candidateId ID not found' };
    }
    console.log('candidateId ID:', candidateId);
    const graphqlQueryObj = JSON.stringify({
      query: graphqlMutationToDeleteManyCandidates,
      variables: { filter: { id: { in: [candidateId] } } },
    });

    console.log('Going to try and delete candidate');
    try {
      const response = await this.staticGraphQLService.executeGraphQL(graphqlMutationToDeleteManyCandidates, {
        filter: { id: { in: [candidateId] } },
      }, apiToken);

      console.log('Deleted candidate:', response.data);
    } catch (err) {
      console.log(
        'Error deleting candidate:',
        err.response?.data || err.message,
      );

      return { status: 'Failed', message: 'Error deleting candidate' };
    }
    const graphqlQueryObjToDeletePerson = JSON.stringify({
      query: graphqlMutationToDeleteManyPeople,
      variables: { filter: { id: { in: [personId] } } },
    });

    console.log('Going to try and delete person');
    try {

      const response = await this.staticGraphQLService.executeGraphQL(graphqlMutationToDeleteManyPeople, {
        filter: { id: { in: [personId] } },
      }, apiToken);

      console.log('Deleted person:', response.data);

      return { status: 'Success' };
    } catch (err) {
      console.log('Error deleting person:', err.response?.data || err.message);

      return { status: 'Failed', message: 'Error deleting person' };
    }
  }

  @Post('delete-people-and-candidates-bulk')
  @UseGuards(JwtAuthGuard)
  async deletePeopleAndCandidatesBulk(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const { candidateIds, personIds } = request.body;
    console.log("Received request to delete people and candidates from bulk:", request.body);

    const BATCH_SIZE = 100;
    const results: { succeeded: string[]; failed: string[] } = {
      succeeded: [],
      failed: [],
    };

    const workspaceName =
      await this.workspaceQueryService.getWorkspaceNameFromToken(apiToken);
    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const dataSourceSchema =
      this.workspaceQueryService.getDataSourceSchema(workspaceId);

    console.log('dataSourceSchema:', dataSourceSchema);
    console.log('workspaceName:', workspaceName);
    console.log('workspaceId:', workspaceId);

    // Helper function to process arrays in batches
    const processBatch = async <T>(
      items: T[],
      batchSize: number,
      processor: (batch: T[]) => Promise<void>
    ): Promise<void> => {
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await processor(batch);
      }
    };

    if (candidateIds?.length) {
      // Process candidates in batches
      await processBatch<string>(candidateIds as string[], BATCH_SIZE, async (batchCandidateIds) => {
        try {
          // First fetch all candidate information to get associated person IDs for this batch
          const graphqlQueryObjToFetchCandidates = JSON.stringify({
            query: graphqlToFetchAllCandidateData,
            variables: { filter: { id: { in: batchCandidateIds } } },
          });

          const candidatesResponse = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, {
            filter: { id: { in: batchCandidateIds } },
          }, apiToken);


          const candidates = candidatesResponse?.data?.data?.candidates as { 
            edges: CandidateEdge[];
            pageInfo: PageInfo;
          } | undefined;

          const candidateNodes =
            candidates?.edges || [];

          // Collect all person IDs associated with these candidates
          const personIdsFromCandidates = candidateNodes
            .map((edge: { node: { people: { id: any; }; }; }) => edge.node?.people?.id)
            .filter((id: any) => id);

          // Queue field values deletion for processing
          await this.deleteFieldValuesService.queueDeleteFieldValues(
            batchCandidateIds,
            dataSourceSchema,
            workspaceId,
          );

          // Delete candidates in this batch
          // const graphqlQueryObjDeleteCandidates = JSON.stringify({
          //   query: graphqlMutationToDeleteManyCandidates,
          //   variables: { filter: { id: { in: batchCandidateIds } } },
          // });

          await this.staticGraphQLService.executeGraphQL(graphqlMutationToDeleteManyCandidates, {
            filter: { id: { in: batchCandidateIds } },
          }, apiToken);

          // Delete associated people in this batch
          if (personIdsFromCandidates.length > 0) {
            // const graphqlQueryObjDeletePeople = JSON.stringify({
            //   query: graphqlMutationToDeleteManyPeople,
            //   variables: { filter: { id: { in: personIdsFromCandidates } } },
            // });
            await this.staticGraphQLService.executeGraphQL(graphqlMutationToDeleteManyPeople, {
              filter: { id: { in: personIdsFromCandidates } },
            }, apiToken);
          }

          results.succeeded.push(...batchCandidateIds);
        } catch (err) {
          console.error('Error in candidate batch deletion:', err);
          results.failed.push(...batchCandidateIds);
        }
      });
    }

    if (personIds?.length) {
      // Process people in batches
      await processBatch<string>(personIds as string[], BATCH_SIZE, async (batchPersonIds) => {
        try {
          // First fetch all person information to get associated candidate IDs for this batch

          const peopleResponse = await this.staticGraphQLService.executeGraphQL(graphqlQueryToFindManyPeople, {
            filter: { id: { in: batchPersonIds } },
          }, apiToken);

          const people = peopleResponse?.data?.data?.people as { 
            edges: PersonEdge[];
            pageInfo: PageInfo;
          } | undefined;

          const peopleNodes = people?.edges || [];

          // Collect all candidate IDs associated with these people
          const candidateIdsFromPeople = peopleNodes
            .flatMap((edge) => edge.node?.candidates?.edges || [])
            .map((edge) => edge?.node?.id)
            .filter((id) => id);

          // Queue field values deletion for processing
          if (candidateIdsFromPeople.length > 0) {
            await this.deleteFieldValuesService.queueDeleteFieldValues(
              candidateIdsFromPeople,
              dataSourceSchema,
              workspaceId,
            );

            await this.staticGraphQLService.executeGraphQL(graphqlMutationToDeleteManyCandidates, {
              filter: { id: { in: candidateIdsFromPeople } },
            }, apiToken);
          }

          await this.staticGraphQLService.executeGraphQL(graphqlMutationToDeleteManyPeople, {
            filter: { id: { in: batchPersonIds } },
          }, apiToken);

          results.succeeded.push(...batchPersonIds);
        } catch (err) {
          console.error('Error in people batch deletion:', err);
          results.failed.push(...batchPersonIds);
        }
      });
    }

    if (results.failed.length > 0) {
      return {
        status: 'Partial',
        message: `Successfully deleted ${results.succeeded.length} items, failed to delete ${results.failed.length} items`,
        results,
      };
    }

    return {
      status: 'Success',
      message: `Successfully deleted ${results.succeeded.length} items`,
      results,
    };
  }

  @Post('remove-chats')
  async removeChats(@Req() request: any): Promise<object> {
    return { status: 'Success' };
  }

  @Post('check-human-like')
  @UseGuards(JwtAuthGuard)
  async checkHumanLike(@Req() request: any): Promise<object> {
    console.log('This is the request body', request.body);
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

      const personObj: PersonNode | undefined = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).getPersonDetailsByPhoneNumber(request.body.phoneNumberFrom, apiToken);

      console.log('Person object receiveed::', personObj);
      const checkHumanLike = await new HumanLikeLLM(
        this.workspaceQueryService,
      ).checkIfResponseMessageSoundsHumanLike(
        request.body.contentObj,
        apiToken,
      );

      console.log('checkHumanLike:', checkHumanLike);

      return { status: 'Success' };
    } catch (err) {
      return { status: err };
    }
  }

  @Post('update-whatsapp-delivery-status')
  @UseGuards(JwtAuthGuard)
  async updateDeliveryStatus(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const listOfMessagesIds: string[] = request.body.listOfMessagesIds;

    try {
      for (const id of listOfMessagesIds) {
        const variablesToUpdateDeliveryStatus = {
          idToUpdate: id,
          input: {
            whatsappDeliveryStatus: 'readByRecruiter',
          },
        };
        // debugger
        const graphqlQueryObjForUpdationForDeliveryStatus = JSON.stringify({
          query: graphqlToUpdateWhatsappMessageId,
          variables: variablesToUpdateDeliveryStatus,
        });

        const responseOfDeliveryStatus = await this.staticGraphQLService.executeGraphQL(graphqlToUpdateWhatsappMessageId, variablesToUpdateDeliveryStatus, apiToken);

        console.log(
          'responseOfDeliveryStatus::',
          responseOfDeliveryStatus?.data,
        );
        // console.log('Res:::', responseOfDeliveryStatus?.data, "for wamid::", responseOfDeliveryStatus?.data);
        console.log(
          '---------------DELIVERY STATUS UPDATE DONE-----------------------',
        );
      }

      return { status: 'Success' };
    } catch (err) {
      return { status: err };
    }
  }

  @Post('upload-jd')
  @UseGuards(JwtAuthGuard)
  async uploadJD(@Req() request: any) {
    try {
      const { jobId, attachmentUrl } = request.body;

      console.log('jobId:', jobId);
      console.log('attachmentUrl:', attachmentUrl);
      console.log(
        'request.headers.authorization:',
        request.headers.authorization,
      );
      
      if (!jobId || !attachmentUrl) {
        throw new HttpException(
          'Missing jobId or attachmentUrl',
          HttpStatus.BAD_REQUEST,
        );
      }

      const authToken = request.headers.authorization.split(' ')[1];
      
      // Use the local JD upload service instead of calling Python service
      const result = await this.jdUploadService.processJDFromAttachmentUrl(
        jobId,
        attachmentUrl,
        authToken,
      );

      console.log('Received processed jd uploaded ::', result);
      return result;
    } catch (error) {
      console.log('Error in uploadJD servers side:', error);
      throw new HttpException(
        error.message || 'Failed to process JD',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('create-prompts')
  @UseGuards(JwtAuthGuard)
  async createPrompts(@Req() request: any): Promise<object> {
    try {
      console.log('request.body: to create new prompts::', request.body);
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const jobId = request.body.jobId;

      const jobIdValidation = validateAndExtractJobId(jobId);
      if (!jobIdValidation.isValid) {
        return createJobIdErrorResponse(jobIdValidation.error!);
      }

      const actualJobId = jobIdValidation.jobId!;
      console.log('jobId::', actualJobId);

      for (const prompt of prompts) {
        const createResponse = await this.staticGraphQLService.executeGraphQL(graphqlToCreateOnePrompt, {
          input: {
            name: prompt.name,
            prompt: prompt.prompt,
            position: 'first',
            jobId: actualJobId,
          },
        }, apiToken);

        console.log(`${prompt.name} created successfully`);

      }
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to create prompts',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { status: 'Success' };
  }

  @Post('share-jd-to-candidate')
  @UseGuards(JwtAuthGuard)
  async shareJDToCandidate(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const { candidateId } = request.body;

      if (!candidateId) {
        throw new HttpException('Missing candidateId', HttpStatus.BAD_REQUEST);
      }

      // Fetch candidate details using graphql
      const graphqlQueryObj = JSON.stringify({
        query: graphqlToFetchAllCandidateData,
        variables: { filter: { id: { eq: candidateId } } },
      });

      const candidateResponse = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, {
        filter: { id: { eq: candidateId } },
      }, apiToken);

      const candidates = candidateResponse?.data?.data?.candidates as {   
        edges: CandidateEdge[];
        pageInfo: PageInfo;
      } | undefined;

      const candidateNode =
        candidates?.edges[0]?.node;

      if (!candidateNode) {
        throw new HttpException('Candidate not found', HttpStatus.NOT_FOUND);
      }
      const personId = candidateNode?.people?.id;

      console.log('personId:', personId);
      console.log('candidateNode:', candidateNode);
      const personObj = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).getPersonDetailsByPersonId(personId, apiToken);

      console.log('personObj:', personObj);
      
      if (!personObj) {
        throw new HttpException(
          'Person details not found',
          HttpStatus.NOT_FOUND,
        );
      }

      console.log('personObj:', personObj);
      const chatControl: ChatControlsObjType = {
        chatControlType: 'startChat',
      };
      await new ToolCallsProcessing(
        this.workspaceQueryService,
        this.staticGraphQLService, 
      ).shareJDtoCandidate(
        candidateNode,
        candidateNode.jobs,
        chatControl,
        apiToken,
      );
      return { status: 'Success', message: 'JD shared successfully' };
    } catch (error) {
      console.error('Error sharing JD:', error);
      throw new HttpException(
        error.message || 'Failed to share JD',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('send-baileys-message-to-self')
  @UseGuards(JwtAuthGuard)
  async sendBaileysMessageToSelf(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const origin = request.headers.origin;
      
      // Import the BaileysWhatsappAPI class
      const { BaileysWhatsappAPI } = await import('../services/whatsapp-api/baileys/callBaileys');
      
      // Create instance of BaileysWhatsappAPI
      const baileysAPI = new BaileysWhatsappAPI(
        this.workspaceQueryService,
        this.staticGraphQLService,
      );

      // Get recruiter profile to get the actual phone number
      const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileFromCurrentUser(apiToken, origin);
      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      console.log('recruiterProfile', recruiterProfile);
      
      if (!recruiterProfile?.phoneNumber) {
        throw new HttpException('Recruiter phone number not found', HttpStatus.BAD_REQUEST);
      }

      // Create a simple message object for sending text message
      const sendTextMessageObj = {
        phoneNumberFrom: recruiterProfile.phoneNumber,
        phoneNumberTo: recruiterProfile.phoneNumber,
        messages: 'This is a sample test message from Arxena API'
      };

      // Create a minimal mock candidate for the API call
      const mockCandidate = {
        id: 'test-candidate-id',
        name: 'Test Candidate',
        jobs: {
          id: 'test-job-id',
          title: 'Test Job',
          company: { name: 'Test Company' },
          recruiterId: currentUser?.workspaceMember?.id
        }
      } as any;

      // Call the simpler sendWhatsappTextMessageViaBaileys function
      const response = await baileysAPI.sendWhatsappTextMessageViaBaileys(
        sendTextMessageObj,
        mockCandidate,
        apiToken,
      );

      console.log('Baileys API response:', response);

      return { status: 'success', message: 'Sample Baileys message sent successfully' };
    } catch (error) {
      console.error('Error sending sample Baileys message:', error);
      throw new HttpException(
        error.message || 'Failed to send sample Baileys message',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('send-chat-candidate-id')
  @UseGuards(JwtAuthGuard)
  async sendChatCandidateId(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const messageToSend = request?.body?.messageToSend;
    const candidateId = request.body.candidateId;
    await this.sendChatCandidateById(candidateId, messageToSend, apiToken);
    return { status: 'success' };
  }


  @Post('send-bulk-chats-by-candidate-ids')
  async sendBulkChatsByCandidateIds(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const candidateIds = request.body.candidateIds;
    console.log('candidateIds', candidateIds);
    console.log('Number of candidate Ids to start chats', candidateIds.length);
    for (const candidateId of candidateIds) {
      await this.sendChatCandidateById(candidateId, request.body.messageToSend, apiToken);
    }
    return { status: 'Success' };
  }
  async sendChatCandidateById(candidateId: string, messageToSend: string, apiToken: string): Promise<void> {
  
    const candidateNode: CandidateNode | undefined = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getCandidateDetailsById(candidateId, apiToken);


    console.log('This is the chat reply:', messageToSend);
    const candidateJob: Job | undefined = candidateNode?.jobs;
    const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(
      candidateJob as Job,
      apiToken,
    );
  
    console.log('Recruiter profile', recruiterProfile);
    const chatMessages =
      candidateNode?.whatsappMessages?.edges;
    let chatHistory = chatMessages?.[0]?.node?.messageObj || [];
    const chatControl: ChatControlsObjType = {
      chatControlType: 'startChat',
    };
    chatHistory =
      candidateNode?.whatsappMessages?.edges[0]?.node?.messageObj;
    let messageTo:string = candidateNode?.phoneNumber?.primaryPhoneNumber?.length == 10
      ? '91' + candidateNode?.phoneNumber?.primaryPhoneNumber
    : candidateNode?.phoneNumber?.primaryPhoneNumber || '';
    if (candidateNode?.messagingChannel == 'linkedin') {
      messageTo = candidateNode?.linkedinUrl?.primaryLinkUrl || '';
    }
    else{
      messageTo = candidateNode?.phoneNumber?.primaryPhoneNumber?.length == 10
          ? '91' + candidateNode?.phoneNumber?.primaryPhoneNumber
          : candidateNode?.phoneNumber?.primaryPhoneNumber || '';
    }
    console.log("This is the messaging channel ::", candidateNode?.messagingChannel)
    console.log("This is the whatsapp provider ::", candidateNode?.whatsappProvider)
      
    const whatappUpdateMessageObj: whatappUpdateMessageObjType = {
      id: uuidv4(),
      candidateProfile: candidateNode,
      candidateFirstName: candidateNode?.name || '',
      phoneNumberFrom: recruiterProfile.phoneNumber,
      whatsappMessageType:
        candidateNode?.whatsappProvider ||
        'application03',
      phoneNumberTo: messageTo,  
      messages: [{ content: messageToSend }],
      messageType: 'recruiterMessage',
      messageObj: chatHistory,
      lastEngagementChatControl: chatControl.chatControlType,
      whatsappDeliveryStatus: 'created',
      whatsappMessageId: 'startChat',
      typeOfMessage: candidateNode?.messagingChannel || process.env.DEFAULT_WHATSAPP_CLIENT || 'baileys',
    };
  
    // Use MessagingControls to send the message (handles all messaging channels)
    const candidateChatHistory = candidateNode?.whatsappMessages?.edges[0]?.node?.messageObj || [];
    const candidateChatControl: ChatControlsObjType = {
      chatControlType: 'startChat',
    };

    // Use MessagingControls to send the message
    const sendResult = await new MessagingControls(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).sendWhatsappMessage(
      whatappUpdateMessageObj,
      candidateNode,
      candidateJob as Job,
      candidateChatHistory,
      candidateChatControl,
      apiToken,
    );

    if (sendResult.status === 'failed') {
      console.log('Message sending failed:', sendResult.message);
      return;
    }
  
  }

}