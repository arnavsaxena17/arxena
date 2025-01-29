import moment from 'moment-timezone';
import { Body, Controller, Get, InternalServerErrorException, NotFoundException, Post, Req, UseGuards } from '@nestjs/common';
import { axiosRequest , axiosRequestForMetadata} from '../candidate-sourcing/utils/utils';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';
import { PersonService } from '../candidate-sourcing/services/person.service';
import { CandidateService } from '../candidate-sourcing/services/candidate.service';
import { ChatService } from '../candidate-sourcing/services/chat.service';
import { GoogleSheetsService } from './google-sheets.service';
import {  graphqlToFetchAllCandidateData, graphQlToUpdateCandidate, mutationToUpdateOnePerson } from '../arx-chat/graphql-queries/graphql-queries-chatbot';
import { CandidateSourcingController } from '../candidate-sourcing/controllers/candidate-sourcing.controller';
import {transformFieldValue, transformFieldName} from '../candidate-sourcing/utils/data-transformation-utility';
import { ProcessCandidatesService } from '../candidate-sourcing/jobs/process-candidates.service';
import { request } from 'node:http';


@Controller('fetch-google-apps-data')
export class GoogleSheetsDataController {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly chatService: ChatService,
    private readonly processCandidatesService: ProcessCandidatesService,
    private readonly sheetsService: GoogleSheetsService,
    private readonly personService: PersonService,
    private readonly candidateService: CandidateService,

  ) {
  }


  @Post('enrichment-data')
  async enrichmentData(@Body() body: any) {
    console.log('Called Enrichmetn Data with Request Body:', body);
    console.log('Request Body:', body);

    const enrichmentPayload = {
      enrichments: body,
      objectNameSingular: body[0]?.objectNameSingular || '',
      availableSortDefinitions: body[0]?.availableSortDefinitions || [],
      availableFilterDefinitions: body[0]?.availableFilterDefinitions || [],
      objectRecordId: body[0]?.objectRecordId || '',
      selectedRecordIds: body[0]?.selectedRows?.map(row => row[0]) || [] // Transform selectedRows to selectedRecordIds
    };

    
    const spreadsheetId = body[0]?.googleSheetId; // Adjust this based on your actual payload structure
    console.log("got spreadsheet Id:", spreadsheetId);
    // Get workspace token
    const tokenData = await this.getWorkspaceTokenForGoogleSheet(spreadsheetId);
    if (!tokenData || !tokenData.token) {
      throw new Error('Unable to get valid workspace token');
    }

    console.log("got Token Data:", tokenData);


    const candidateSourcingController = new CandidateSourcingController(
      this.sheetsService,
      this.workspaceQueryService,
      this.personService, 
      this.candidateService,
      this.processCandidatesService,
      this.chatService
    );
    console.log("candidateSourcingController:", candidateSourcingController);

    const result = await candidateSourcingController.createEnrichments({
      body: enrichmentPayload,
      headers: {
        authorization: `Bearer ${tokenData.token}`
      }
    });
    console.log("Respult reaceieved:", result);
    return result;
    }


  private async getWorkspaceTokenForGoogleSheet(spreadsheetId: string) {
    console.log("gpong to get workspace token for google sheet with id :", spreadsheetId);
    const results = await this.workspaceQueryService.executeQueryAcrossWorkspaces(
      async (workspaceId, dataSourceSchema, transactionManager) => {
        // Query to find the Google Sheet integration record
        console.log("workspaceId:", workspaceId);
        const sheetIntegration = await this.workspaceQueryService.executeRawQuery(
          `SELECT * FROM ${dataSourceSchema}."_job" 
           WHERE "googleSheetId" = $1`,
          [spreadsheetId],
          workspaceId,
          transactionManager
        );
        if (sheetIntegration.length > 0) {
          // Get API keys for the workspace
          const apiKeys = await this.workspaceQueryService.getApiKeys(
            workspaceId, 
            dataSourceSchema, 
            transactionManager
          );
          if (apiKeys.length > 0) {
            // Generate token using the first available API key
            const apiKeyToken = await this.workspaceQueryService.tokenService.generateApiKeyToken(
              workspaceId,
              apiKeys[0].id,
              apiKeys[0].expiresAt
            );
            return apiKeyToken ? {
              token: apiKeyToken.token,
              workspaceId,
              integrationId: sheetIntegration[0].id
            } : null;
          }
        }
        return null;
      }
    );
  
    // Return first non-null result
    return results.find(result => result !== null);
  }
  
  sheetUpdateExternalTasks(field: string, value: any, candidateId: string, personId: string, unique_string_key:string, apiToken: string, spreadsheetId:string) {
    console.log("Field:", field, "Value:", value, "candidateId:", candidateId, "personId:", personId, "unique_string_key:", unique_string_key);
    switch (field) {
        case 'isProfilePurchsed':
            if (value.toLowerCase() === 'yes' || value === true) {
              this.personService.purchaseAndUpdateApnaProfile(field, value, candidateId, personId, unique_string_key, apiToken, spreadsheetId);
            }
            else{
              console.log("isProfilePurchsed probably no:", value);
            }
            console.log("isProfilePurchsed:", value);
            break;
        case 'email_address':
            console.log("Email address field:", value);
            break;
        default:
            console.log("Field not recognized:", field);
    }
  }


  @Post('post-batch-data')
  async postBatchData(@Body() data: { 
      spreadsheetId: string, 
      updates: Array<{
          candidateId: string,
          personId: string,
          field: string,
          unique_string_key:string,
          value: any
      }>
  }) {
      console.log("Batch data received:", data);
      
      const tokenData = await this.getWorkspaceTokenForGoogleSheet(data.spreadsheetId);
      if (!tokenData) {
          throw new Error('No valid workspace found for this spreadsheet');
      }

        for (const update of data.updates) {
          console.log("update:", update);
          this.sheetUpdateExternalTasks(update.field, update.value, update.candidateId, update.personId, update.unique_string_key, tokenData.token, data.spreadsheetId);
        }

      // Group updates by both candidateId and personId
      const updates = data.updates.reduce((acc, update) => {
          if (!acc[update.candidateId]) {
              acc[update.candidateId] = {
                  candidateUpdates: {},
                  personUpdates: {},
                  personId: update.personId
              };
          }
          console.log("update.field:", update.field);


          const transformedField = transformFieldName(update.field);
          console.log("transformed Field:: field", transformedField, "for transformed field:", update.field, "update value is :", update.value);
          const transformedValue = transformFieldValue(update.field, update.value);
          console.log("transformed Field:: value", transformedValue, "for transformed field:", update.value);
  
          if (this.isPersonField(update.field)) {
              acc[update.candidateId].personUpdates[transformedField] = transformedValue;
          } else {
              acc[update.candidateId].candidateUpdates[transformedField] = transformedValue;
          }
          console.log("Acc:", acc);
          console.log("Accupdate unique:", update.unique_string_key);


          return acc;
      }, {} as Record<string, {
          candidateUpdates: Record<string, any>,
          personUpdates: Record<string, any>,
          personId: string
      }>);



      
      console.log("updates:", updates);
      const results: Array<{
          candidateId: string;
          personId: string;
          success: boolean;
          timestamp?: string;
          error?: any
      }> = [];
  
      const candidateIds = Object.keys(updates);
      const batchSize = 10;
  
      for (let i = 0; i < candidateIds.length; i += batchSize) {
          const batch = candidateIds.slice(i, i + batchSize);
          
          const batchPromises = batch.map(async (candidateId) => {
              try {
                  const updateData = updates[candidateId];
                  
                  // Update candidate if there are candidate fields
                  if (Object.keys(updateData.candidateUpdates).length > 0) {
                      const candidateUpdateMutation = {
                          query: graphQlToUpdateCandidate,
                          variables: {
                              idToUpdate: candidateId,
                              input: updateData.candidateUpdates
                          }
                      };
                      await axiosRequest(
                          JSON.stringify(candidateUpdateMutation),
                          tokenData.token
                      );
                  }
                  // Update person if there are person fields
                  if (Object.keys(updateData.personUpdates).length > 0 && updateData.personId) {
                      const personUpdateMutation = {
                          query: mutationToUpdateOnePerson, // You'll need to define this
                          variables: {
                              idToUpdate: updateData.personId,
                              input: updateData.personUpdates
                          }
                      };
                      await axiosRequest(
                          JSON.stringify(personUpdateMutation),
                          tokenData.token
                      );
                  }
                  return {
                      candidateId,
                      personId: updateData.personId,
                      success: true,
                      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
                  };
              } catch (error) {
                  console.error(`Error processing update for candidateId ${candidateId}:`, error);
                  return {
                      candidateId,
                      personId: updates[candidateId].personId,
                      success: false,
                      error: error.message
                  };
              }
          });
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);
      }
      return {
          total: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          results: results
      };
  }
  
  // Helper method to determine if a field belongs to person
  private isPersonField(field: string): boolean {
      const personFields = [
          'phone_numbers',
          'email_address',
      ];
      return personFields.includes(field);
  }
  
  
  
  @Post('post-data')
  async postData(@Body() data: { spreadsheetId: string, full_name: string, UniqueKey: string }) {
    console.log("data:::: of post-data:", data);
    const tokenData = await this.getWorkspaceTokenForGoogleSheet(data.spreadsheetId);
    console.log("tokenData for workspace token google sheet:::::", tokenData);
    if (!tokenData) {
      throw new Error('No valid workspace found for this spreadsheet');
    }
    const candidateQuery = { query: graphqlToFetchAllCandidateData, variables: { filter: { uniqueStringKey: { eq: data.UniqueKey }, }, limit: 1 } };
    
    const candidateResponse = await axiosRequest(
      JSON.stringify(candidateQuery),
      tokenData?.token || ''
    );
    
    const candidate = candidateResponse.data?.data?.candidates?.edges[0]?.node;
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }
    
    const updateMutation = {
      query: graphQlToUpdateCandidate,
      variables: {
      idToUpdate: candidate.id,
      input: data
      }
    };
    
      // Execute update mutation
      const updateResponse = await axiosRequest(
        JSON.stringify(updateMutation),
        tokenData?.token || ''
      );
    
      if (updateResponse.data?.errors) {
        throw new InternalServerErrorException('Failed to update candidate');
      }
    
      return {
        success: true,
        candidateId: candidate.id,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };
  
    } 
  
  
  @Get('get-data')
  async getData(@Body()request: any) {
    
    console.log("get data called");

    } 
  

}