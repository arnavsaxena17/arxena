import { Body, Controller, InternalServerErrorException, NotFoundException, Post } from '@nestjs/common';
import moment from 'moment-timezone';
import { WebSocketGateway } from 'src/modules/websocket/websocket.gateway';
import { graphqlToFetchAllCandidateData, graphQltoUpdateOneCandidate, mutationToUpdateOnePerson } from 'twenty-shared';
import { CandidateSourcingController } from '../candidate-sourcing/controllers/candidate-sourcing.controller';
import { ProcessCandidatesService } from '../candidate-sourcing/jobs/process-candidates.service';
import { AiFilteringProcessorService } from '../candidate-sourcing/services/ai-filtering-processor.service';
import { AiFilteringService } from '../candidate-sourcing/services/ai-filtering.service';
import { CandidateDataService } from '../candidate-sourcing/services/candidate-data.service';
import { CandidateService } from '../candidate-sourcing/services/candidate.service';
import { ChatService } from '../candidate-sourcing/services/chat.service';
import { FilterDescriptionProcessorService } from '../candidate-sourcing/services/filter-description-processor.service';
import { PersonService } from '../candidate-sourcing/services/person.service';
import { StaticGraphQLService } from '../graphql/static-graphql.service';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';
import { GoogleSheetsService } from './google-sheets.service';

import { DeleteFieldValuesService } from '../candidate-sourcing/jobs/delete-field-values.service';
import { ProcessAiFiltersService } from '../candidate-sourcing/jobs/process-ai-filters.service';
import { CandidateWorkspaceGraphQLService } from '../candidate-sourcing/services/candidate-workspace-graphql.service';
import { JDParserService } from '../candidate-sourcing/services/jd-parser.service';
import { OtherFieldsService } from '../candidate-sourcing/services/other-fields.service';
import { UploadProgressPubSubService } from '../candidate-sourcing/services/upload-progress-pubsub.service';
import { FileStorageService } from '../file-storage/services/file-storage.service';

@Controller('fetch-google-apps-data')
export class GoogleSheetsDataController {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly chatService: ChatService,
    private readonly processCandidatesService: ProcessCandidatesService,
    private readonly sheetsService: GoogleSheetsService,
    private readonly processAiFiltersService: ProcessAiFiltersService,
    private readonly personService: PersonService,
    private readonly candidateService: CandidateService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly webSocketGateway: WebSocketGateway,
    private readonly aiFilteringService: AiFilteringService,
    private readonly aiFilteringProcessorService: AiFilteringProcessorService,
    private readonly candidateDataService: CandidateDataService,
    private readonly filterDescriptionProcessorService: FilterDescriptionProcessorService,
    private readonly uploadProgressPubSubService: UploadProgressPubSubService,
    private readonly deleteFieldValuesService: DeleteFieldValuesService,
    private readonly jdParserService: JDParserService,
    private readonly candidateWorkspaceGraphQLService: CandidateWorkspaceGraphQLService,
    private readonly otherFieldsService: OtherFieldsService,
    private readonly fileStorageService: FileStorageService,
  ) {
  }


  @Post('enrichment-data')
  async enrichmentData(@Body() body: any) {
    const aiFiltersPayload = {
      aiFilters: body,
      jobId: body[0]?.jobId || '',
      objectNameSingular: body[0]?.objectNameSingular || '',
      availableSortDefinitions: body[0]?.availableSortDefinitions || [],
      availableFilterDefinitions: body[0]?.availableFilterDefinitions || [],
      objectRecordId: body[0]?.objectRecordId || '',
      selectedRecordIds: body[0]?.selectedRows?.map((row: any[]) => row[0]) || []
    };
    const spreadsheetId = body[0]?.googleSheetId;
    const tokenData = await this.getWorkspaceTokenForGoogleSheet(spreadsheetId);
    if (!tokenData || !tokenData.token) {
      throw new Error('Unable to get valid workspace token');
    }
    const candidateSourcingController = new CandidateSourcingController(
      this.sheetsService,
      this.workspaceQueryService,
      this.candidateService,
      this.processCandidatesService,
      this.processAiFiltersService,
      this.personService,
      this.staticGraphQLService,
      this.aiFilteringService,
      this.filterDescriptionProcessorService,
      this.uploadProgressPubSubService,
      this.deleteFieldValuesService,
      this.jdParserService,
      this.candidateWorkspaceGraphQLService,
      this.otherFieldsService,
      this.fileStorageService,
    );
    const result = await candidateSourcingController.processAiFilters({
      body: aiFiltersPayload,
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
      async (workspaceId, _dataSourceSchema, _transactionManager) => {
        console.log("workspaceId:", workspaceId);
        const projectRepository =
          await this.workspaceQueryService.getObjectRepository<{
            id: string;
            googleSheetId?: string;
          }>(workspaceId, 'project');
        const sheetIntegration = await projectRepository.find({
          where: { googleSheetId: spreadsheetId },
        });
        if (sheetIntegration.length > 0) {
          // Get API keys for the workspace
          const apiKeys = await this.workspaceQueryService.getApiKeys(
            workspaceId,
          );
          if (apiKeys && apiKeys.length > 0) {
            // Generate token using the first available API key
            const apiKeyToken = await this.workspaceQueryService.accessTokenService.generateAccessToken(
              workspaceId,
              apiKeys[0].id,
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

  sheetUpdateExternalTasks(field: string, value: any, candidateId: string, personId: string, uniqueStringKey:string, apiToken: string, spreadsheetId:string) {
    console.log("Field:", field, "Value:", value, "candidateId:", candidateId, "personId:", personId, "uniqueStringKey:", uniqueStringKey);
    switch (field) {
        case 'isProfilePurchased':
            if (value.toLowerCase() === 'yes' || value === true) {
              this.personService.purchaseAndUpdateApnaProfile(field, value, candidateId, personId, uniqueStringKey, apiToken, spreadsheetId);
            }
            else{
              console.log("isProfilePurchased probably no:", value);
            }
            console.log("isProfilePurchased:", value);
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
          uniqueStringKey:string,
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
          this.sheetUpdateExternalTasks(update.field, update.value, update.candidateId, update.personId, update.uniqueStringKey, tokenData.token, data.spreadsheetId);
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


          // const transformedField = transformFieldName(update.field);
          // console.log("transformed Field:: field", transformedField, "for transformed field:", update.field, "update value is :", update.value);
          // const transformedValue = transformFieldValue(update.field, update.value);
          // console.log("transformed Field:: value", transformedValue, "for transformed field:", update.value);

          // if (this.isPersonField(update.field)) {
          //     acc[update.candidateId].personUpdates[transformedField] = transformedValue;
          // } else {
          //     acc[update.candidateId].candidateUpdates[transformedField] = transformedValue;
          // }
          console.log("Acc:", acc);
          console.log("Accupdate unique:", update.uniqueStringKey);


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
                          query: graphQltoUpdateOneCandidate,
                          variables: {
                              idToUpdate: candidateId,
                              input: updateData.candidateUpdates
                          }
                      };
                      await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, { idToUpdate: candidateId, input: updateData.candidateUpdates }, tokenData.token);
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
                      await this.staticGraphQLService.executeGraphQL(mutationToUpdateOnePerson, { idToUpdate: updateData.personId, input: updateData.personUpdates }, tokenData.token);
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
  async postData(@Body() data: { spreadsheetId: string, full_name: string, uniqueStringKey: string }) {
    console.log("data:::: of post-data:", data);
    const tokenData = await this.getWorkspaceTokenForGoogleSheet(data.spreadsheetId);
    console.log("tokenData for workspace token google sheet:::::", tokenData);
    if (!tokenData) {
      throw new Error('No valid workspace found for this spreadsheet');
    }

    const candidateResponse = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, { filter: { uniqueStringKey: { eq: data.uniqueStringKey }, }, limit: 1 } , tokenData?.token || '');

    const candidate = candidateResponse.data?.data?.candidates?.edges[0]?.node;
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    const updateMutation = {
      query: graphQltoUpdateOneCandidate,
      variables: {
      idToUpdate: candidate.id,
      input: data
      }
    };

      const updateResponse = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, { idToUpdate: candidate.id, input: data }, tokenData?.token || '');

      if (updateResponse.data?.errors) {
        throw new InternalServerErrorException('Failed to update candidate');
      }

      return {
        success: true,
        candidateId: candidate.id,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };
    }
}
