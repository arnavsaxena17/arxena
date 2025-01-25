// google-sheets.service.ts
import { ConsoleLogger, Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import axios, { all } from 'axios';
import * as CandidateSourcingTypes from 'src/engine/core-modules/candidate-sourcing/types/candidate-sourcing-types';
import { OAuth2Client } from 'google-auth-library';
import { UpdateOneJob } from '../candidate-sourcing/graphql-queries';
import { axiosRequest } from '../workspace-modifications/workspace-modifications.controller';
import { FetchAndUpdateCandidatesChatsWhatsapps } from '../arx-chat/services/candidate-engagement/update-chat';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';
import uniq from 'lodash.uniq';

const rowDataValues = [
  ...CandidateSourcingTypes.columnDefinitions.map(col => ({
    userEnteredValue: { stringValue: col.header },
    userEnteredFormat: {
      textFormat: { bold: true },
    },
  })),
  { userEnteredValue: { stringValue: 'engagementStatus' }, userEnteredFormat: { textFormat: { bold: true } } },
  { userEnteredValue: { stringValue: 'startChat' }, userEnteredFormat: { textFormat: { bold: true } } },
  { userEnteredValue: { stringValue: 'startVideoInterviewChat' }, userEnteredFormat: { textFormat: { bold: true } } },
  { userEnteredValue: { stringValue: 'startMeetingSchedulingChat' }, userEnteredFormat: { textFormat: { bold: true } } },
  { userEnteredValue: { stringValue: 'stopChat' }, userEnteredFormat: { textFormat: { bold: true } } },
  { userEnteredValue: { stringValue: 'candConversationStatus' }, userEnteredFormat: { textFormat: { bold: true } } },
  { userEnteredValue: { stringValue: 'chatCount' }, userEnteredFormat: { textFormat: { bold: true } } },
  { userEnteredValue: { stringValue: 'chatMessages' }, userEnteredFormat: { textFormat: { bold: true } } },


  { userEnteredValue: { stringValue: 'personId' }, userEnteredFormat: { textFormat: { bold: true } } },
  { userEnteredValue: { stringValue: 'candidateId' }, userEnteredFormat: { textFormat: { bold: true } } },
]


@Injectable()
export class GoogleSheetsService {
  private oauth2Client;

  private readonly workspaceQueryService: WorkspaceQueryService;
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(process.env.AUTH_GOOGLE_CLIENT_ID, process.env.AUTH_GOOGLE_CLIENT_SECRET, process.env.AUTH_GOOGLE_CALLBACK_URL);
  }

  private getColumnLetter(index: number): string {
    let columnLetter = '';
    while (index >= 0) {
      columnLetter = String.fromCharCode(65 + (index % 26)) + columnLetter;
      index = Math.floor(index / 26) - 1;
    }
    return columnLetter;
  }

  private rateLimiter = {
    writeRequests: {
      tokens: 60, // Google Sheets allows 60 writes per minute
      lastRefill: Date.now(),
      refillRate: 60000, // 1 minute in ms
    },
  };

  async updateGoogleSheetsWithChatData(results: any[], apiToken: string): Promise<void> {
    const sheetUpdates = new Map<
      string,
      Array<{
        candidateId: string;
        chatMessages: string;
        chatCount: number;
        candConversationStatus: string;
      }>
    >();

    const fetchUpdateService = new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService);

    // Process results and group by sheet ID
    for (const result of results) {
      if (!result?.googleSheetId) continue;

      const formattedChat = await fetchUpdateService.formatChat(result.whatsappMessages);
      const updateData = {
        candidateId: result.candidateId,
        chatMessages: formattedChat,
        chatCount: result.whatsappMessages.length,
        candConversationStatus: result.candidateStatus,
      };

      if (!sheetUpdates.has(result.googleSheetId)) {
        sheetUpdates.set(result.googleSheetId, []);
      }
      sheetUpdates.get(result.googleSheetId)?.push(updateData);
    }

    // Update each Google Sheet with batched updates
    const auth = await this.loadSavedCredentialsIfExist(apiToken);
    if (auth) {
      for (const [sheetId, updates] of sheetUpdates) {
        try {
          // Get existing data to find column indices
          const existingData = await this.getValues(auth, sheetId, 'Sheet1');
          if (!existingData?.values) continue;

          const headers = existingData.values[0];
          const candidateIdIndex = headers.findIndex(h => h === 'candidateId');
          const chatMessagesIndex = headers.findIndex(h => h === 'chatMessages');
          const chatCountIndex = headers.findIndex(h => h === 'chatCount');
          const candConversationStatusIndex = headers.findIndex(h => h === 'candConversationStatus');

          // Prepare batch updates
          const batchUpdates: Array<{ range: string; values: string[][] }> = updates.flatMap(update => {
            const rowIndex = existingData?.values?.findIndex(row => row[candidateIdIndex] === update.candidateId);
            if (rowIndex === -1) return [];

            const rowUpdates: Array<{ range: string; values: string[][] }> = [];
            if (rowIndex !== -1 && rowIndex !== undefined) {
              if (chatMessagesIndex !== -1) {
                rowUpdates.push({
                  range: `Sheet1!${this.getColumnLetter(chatMessagesIndex)}${rowIndex + 1}`,
                  values: [[update.chatMessages]],
                });
              }
              if (chatCountIndex !== -1) {
                rowUpdates.push({
                  range: `Sheet1!${this.getColumnLetter(chatCountIndex)}${rowIndex + 1}`,
                  values: [[update.chatCount.toString()]],
                });
              }
              if (candConversationStatusIndex !== -1) {
                rowUpdates.push({
                  range: `Sheet1!${this.getColumnLetter(candConversationStatusIndex)}${rowIndex + 1}`,
                  values: [[update.candConversationStatus]],
                });
              }
            }
            return rowUpdates;
          });

          // Execute batch update
          if (batchUpdates.length > 0) {
            await this.batchUpdateGoogleSheet(auth, sheetId, batchUpdates);
          }
        } catch (error) {
          console.error(`Error updating sheet ${sheetId}:`, error);
        }
      }
    }
  }

  async sortSheetByInferredSalary(auth: any, spreadsheetId: string): Promise<void> {
    const sheets = google.sheets({ version: 'v4', auth });

    try {
      // First, get the headers to find the "Inferred Salary (LPA)" column index
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Sheet1!1:1', // Get first row (headers)
      });

      const headers = response.data.values?.[0] || [];
      const salaryColumnIndex = headers.findIndex(header => header === 'Inferred Salary (LPA)' || header === 'inferred_salary' || header === 'inferredSalary');

      if (salaryColumnIndex === -1) {
        console.log('Salary column not found');
        return;
      }

      // Get sheet ID (assuming it's the first sheet)
      const spreadsheetResponse = await sheets.spreadsheets.get({
        spreadsheetId,
      });
      const sheetId = spreadsheetResponse.data.sheets?.[0].properties?.sheetId;

      // Apply sort
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              sortRange: {
                range: {
                  sheetId: sheetId,
                  startRowIndex: 1, // Skip header row
                  startColumnIndex: 0,
                  endColumnIndex: headers.length,
                },
                sortSpecs: [
                  {
                    dimensionIndex: salaryColumnIndex,
                    sortOrder: 'DESCENDING',
                  },
                ],
              },
            },
          ],
        },
      });
    } catch (error) {
      console.error('Error sorting sheet:', error);
      throw error;
    }
  }

  private async acquireToken() {
    const now = Date.now();
    const timeSinceRefill = now - this.rateLimiter.writeRequests.lastRefill;

    if (timeSinceRefill >= this.rateLimiter.writeRequests.refillRate) {
      this.rateLimiter.writeRequests.tokens = 60;
      this.rateLimiter.writeRequests.lastRefill = now;
    }

    if (this.rateLimiter.writeRequests.tokens <= 0) {
      const waitTime = this.rateLimiter.writeRequests.refillRate - timeSinceRefill;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.acquireToken();
    }

    this.rateLimiter.writeRequests.tokens--;
    return true;
  }

  private async formatHeadersBold(auth: any, spreadsheetId: string, headerLength: number): Promise<void> {
    return this.retryWithBackoff(async () => {
      // Wait for rate limiter token
      await this.acquireToken();

      const sheets = google.sheets({ version: 'v4', auth });

      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                repeatCell: {
                  range: {
                    sheetId: 0,
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: headerLength,
                  },
                  cell: {
                    userEnteredFormat: {
                      textFormat: {
                        bold: true,
                      },
                    },
                  },
                  fields: 'userEnteredFormat.textFormat.bold',
                },
              },
            ],
          },
        });
      } catch (error) {
        // Re-throw the error so retryWithBackoff can handle it
        throw error;
      }
    });
  }

  private async addMissingHeaders(auth: any, spreadsheetId: string, existingHeaders: string[], newHeaders: string[], apiToken: string): Promise<void> {
    // Find headers that exist in newHeaders but not in existingHeaders
    const missingHeaders = newHeaders.filter(header => !existingHeaders.includes(header));

    if (missingHeaders.length === 0) {
      return;
    }

    // Add missing headers to the end of existing headers
    const updatedHeaders = [...existingHeaders, ...missingHeaders];

    // Update the sheet with new headers
    await this.updateValues(auth, spreadsheetId, 'Sheet1!A1', [updatedHeaders], apiToken);

    // Format the new headers bold
    // await this.formatHeadersBold(auth, spreadsheetId, updatedHeaders.length);
  }

  private async initializeSheetIfNeeded(auth: any, googleSheetId: string, newHeaders: string[], existingData: any, apiToken: string): Promise<void> {
    console.log("This is the new  headers that are being entered in initialise sheet if needed:::", newHeaders);
    const sheets = google.sheets({ version: 'v4', auth });

    console.log('Going to check for new headers:::', newHeaders);
    // Initialize sheet with headers if completely empty
    if (!existingData || !existingData.values) {
      console.log('Sheet is empty, initializing with headers');
      await this.updateValues(auth, googleSheetId, 'Sheet1!A1', [newHeaders], apiToken);
      await this.formatHeadersBold(auth, googleSheetId, newHeaders.length);
      existingData.values = [newHeaders];
      return;
    }

    // If sheet has data but no headers
    if (existingData.values.length === 0) {
      console.log('Sheet has no headers, inserting headers');
      await this.updateValues(auth, googleSheetId, 'Sheet1!A1', [newHeaders], apiToken);
      await this.formatHeadersBold(auth, googleSheetId, newHeaders.length);
      existingData.values = [newHeaders];
      return;
    }

    // Get existing headers
    const existingHeaders = existingData.values[0];

    console.log('These are the existing headers that are already created:::', existingHeaders);
    // Use addMissingHeaders instead of implementing the logic directly
    // await this.addMissingHeaders(auth, googleSheetId, existingHeaders, newHeaders, apiToken);

    const headers_to_not_add = [
      'id',
      'first_name',
      'last_name',
      'middle_name',
      'middle_initial',
      'full_name',
      'job_company_name',
      'job_company_id',
      'location_name',
      'job_company_linkedin_url',
      'job_company_website',
      'location_region',
      'location_locality',
      'location_metro',
      'linkedin_url',
      'facebook_url',
      'twitter_url',
      'location_country',
      'profile_title',
      'inferred_salary',
      'inferred_years_experience',
      'industry',
      'country',
      'birth_date_fuzzy',
      'birth_date',
      'gender',
      'email_address',
      'emails',
      'industries',
      'profiles',
      'phone_numbers',
      'job_process',
      'locations',
      'experience',
      'experience_stats',
      'last_seen',
      'last_updated',
      'education',
      'interests',
      'skills',
      'std_last_updated',
      'created',
      'creation_source',
      'data_sources',
      'queryId',
      'title',
      'profile_url',
      'resume_download_url',
      'all_numbers',
      'phone_number',
      'mobile_phone',
      'data_source',
      'job_name',
      'upload_count',
      'upload_id',
      'all_mails',
      'education_institute_ug',
      'education_type_ug',
      'education_year_ug',
      'education_course_ug',
      'education_institute_pg',
      'education_type_pg',
      'education_year_pg',
      'education_course_pg',
      'experience_years',
      'job_title',
      'current_role_tenure',
      'total_job_changes',
      'average_tenure',
      'count_promotions',
      'total_tenure',
      'socialprofiles',
      'hiring_naukri_cookie',
      'uniqueKeyString',
      'unique_key_string',
      'name',
      'pg_graduation_degree',
      'ug_graduation_degree',
      'pg_graduation_year',
      'pg_institute_name',
      'resume_headline',
      'key_skills',
      'preferred_locations',
      'std_function',
      'std_grade',
      'std_function_root',
      'name',
      'pg_institute_name',
      'resume_headline',
      'key_skills',
      'preferred_locations',
      'std_function',
      'std_grade',
      'std_function_root',
      'name',
      'PG Year',
      'UG Year',
      'Status',
      'Notes',
      'UniqueKey',
    ];
    // Find new headers that don't exist in the current sheet
    const chatColumns = ['startChat', 'startVideoInterviewChat', 'startMeetingSchedulingChat', 'stopChat', 'engagementStatus', 'candidateId', 'personId'];

    const newColumnsToAdd = newHeaders.filter(header => !existingHeaders.includes(header) && (!headers_to_not_add.includes(header) || chatColumns.includes(header)));

    console.log('New columns to add:', newColumnsToAdd);
    if (newColumnsToAdd.length > 0) {
      console.log('Adding new columns:', newColumnsToAdd);

      // Add new columns to existing headers
      const updatedHeaders = [...existingHeaders, ...newColumnsToAdd];
      console.log('Thesea re the udpated headers:', updatedHeaders);
      await this.expandSheetGrid(auth, googleSheetId, updatedHeaders.length);

      // Update the first row with new headers
      await this.updateValues(auth, googleSheetId, 'Sheet1!A1', [updatedHeaders], apiToken);
      await this.formatHeadersBold(auth, googleSheetId, updatedHeaders.length);

      // Update existing data structure
      existingData.values[0] = updatedHeaders;

      // Add empty values for new columns in existing rows
      for (let i = 1; i < existingData.values.length; i++) {
        existingData.values[i] = [...existingData.values[i], ...new Array(newColumnsToAdd.length).fill('')];
      }
    }
  }

  private getHeadersFromData(data: CandidateSourcingTypes.UserProfile[]): string[] {
    if (!data || data.length === 0) {
      return CandidateSourcingTypes.columnDefinitions.slice(0, 4).map(col => col.header);
    }

    const headers = new Set<string>();

    // Iterate through each candidate to collect all unique headers
    data.forEach(candidate => {
      CandidateSourcingTypes.columnDefinitions.forEach(def => {
        if (def.key === 'status' || def.key === 'notes' || def.key === 'unique_key_string' || def.key === 'full_name' || def.key === 'email_address' || def.key === 'phone_numbers' || candidate[def.key] !== undefined) {
          headers.add(def.header);
        }
      });

      // Add screening questions that start with 'Ans'
      const ansKeys = Object.keys(candidate).filter(key => key.startsWith('Ans'));
      ansKeys.forEach(key => {
        headers.add(key);
      });
    });
    console.log('These are the headers:::', Array.from(headers));
    return Array.from(headers);
  }

  private formatCandidateRow(candidate: CandidateSourcingTypes.UserProfile, headers: string[]): string[] {
    return headers.map(header => {
      if (header === 'personId' || header === 'candidateId') {
        return '';
      }

      // Handle Ans fields directly from candidate object
      if (header.startsWith('Ans(')) {
        // Access the Ans field directly since it's stored as a property
        return candidate[header]?.toString() || '';
      }

      if (header === 'personId') return candidate.personId || '';
      if (header === 'candidateId') return candidate.candidateId || '';

      // Handle standard columns using columnDefinitions
      const definition = CandidateSourcingTypes.columnDefinitions.find(col => col.header === header);
      if (!definition) {
        return '';
      }

      const value = candidate[definition.key];
      if (definition.format) {
        return definition.format(value);
      }
      return value?.toString() || '';
    });
  }

  private async appendNewCandidates(auth: any, googleSheetId: string, batch: CandidateSourcingTypes.UserProfile[], headers: string[], existingData: any, apiToken: string): Promise<void> {
    // Find index of unique key column
    const uniqueKeyIndex = headers.findIndex(header => header.toLowerCase().includes('unique') && header.toLowerCase().includes('key'));

    if (uniqueKeyIndex === -1) {
      console.log('No unique key column found in headers');
      return;
    }
    // Get existing unique keys
    const existingKeys = new Set(
      existingData.values
        .slice(1)
        .map(row => row[uniqueKeyIndex])
        .filter(key => key),
    );
    // Filter and format new candidates
    const newCandidates = batch.filter(candidate => candidate?.unique_key_string && !existingKeys.has(candidate.unique_key_string));
    if (newCandidates.length === 0) {
      console.log('No new candidates to add');
      return;
    }

    // Use the updated headers from existingData.values[0]
    const currentHeaders = existingData.values[0];
    const candidateRows = newCandidates.map(candidate => this.formatCandidateRow(candidate, currentHeaders));

    // Append new candidates
    const nextRow = existingData.values.length + 1;
    await this.updateValues(auth, googleSheetId, `Sheet1!A${nextRow}`, candidateRows, apiToken);

    console.log(`Successfully appended ${candidateRows.length} new candidates to Google Sheet`);
  }

  private async updateJobWithSheetDetails(jobObject: CandidateSourcingTypes.Jobs, googleSheetUrl: string, googleSheetId: string, apiToken: string): Promise<void> {
    console.log('This is the jobObject:', jobObject);
    console.log('This Updating sheet with usrl:', googleSheetUrl);
    console.log('This Updating sheet with googleSheetId:', googleSheetId);
    const graphqlToUpdateJob = JSON.stringify({
      query: UpdateOneJob,
      variables: {
        idToUpdate: jobObject?.id,
        input: {
          googleSheetUrl: { label: googleSheetUrl, url: googleSheetUrl },
          ...(googleSheetId && { googleSheetId: googleSheetId }),
        },
      },
    });

    try {
      const responseToUpdateJob = await axiosRequest(graphqlToUpdateJob, apiToken);
      console.log('Response from update job in update job with job details:', responseToUpdateJob.data.data);
    } catch (error) {
      console.error('Error updating job with sheet details:', error);
    }
  }

  async processGoogleSheetBatch(batch: CandidateSourcingTypes.UserProfile[], results: any, tracking: any, apiToken: string, googleSheetId: string, jobObject: CandidateSourcingTypes.Jobs): Promise<void> {
    return this.retryWithBackoff(async () => {
      try {
        const auth = await this.loadSavedCredentialsIfExist(apiToken);
        if (!auth) {
          console.log('Google Sheets authentication failed');
          return;
        }

        const headers = this.getHeadersFromData(batch);
        console.log("This is the headers that we objtain from the data:::", headers);
        const lastColumn = this.getColumnLetter(rowDataValues.length);
        const existingSheet = await this.findSpreadsheetByJobName(auth, jobObject.name);

        if (!existingSheet) {
          console.log("Existing job sheet not found, so creating a new one and initialising");
          googleSheetId = await this.createAndInitializeSheet(auth, headers, jobObject, apiToken);
        }
        console.log("This is the lastColumn:::", lastColumn);
        const existingData = await this.getValues(auth, googleSheetId, `Sheet1`);
        

        await this.initializeSheetIfNeeded(auth, googleSheetId, headers, existingData, apiToken);

        await this.appendNewCandidatesToSheet(auth, googleSheetId, batch, headers, existingData, apiToken);
        // await this.updateIdsInSheet(auth, googleSheetId, tracking, apiToken);
      } catch (error) {
        console.log('Error in process Google Sheet Batch:', error);
        if (error.response?.data) {
          console.error('Detailed error:', error.response.data);
        }
      }
    });
  }

  private async createAndInitializeSheet(auth: any, headers:string[], jobObject: CandidateSourcingTypes.Jobs, apiToken: string): Promise<string> {
    const newSheet = await this.createSpreadsheetForJob(jobObject.name, apiToken);
    const googleSheetId = newSheet.googleSheetId;
    const googleSheetUrl = `https://docs.google.com/spreadsheets/d/${googleSheetId}`;
    await this.updateJobWithSheetDetails(jobObject, googleSheetUrl, googleSheetId, apiToken);
    return googleSheetId;
  }

  private async appendNewCandidatesToSheet(auth: any, googleSheetId: string, batch: CandidateSourcingTypes.UserProfile[], headers: string[], existingData: any, apiToken: string): Promise<void> {
    const updates: Array<{ range: string; values: any[][] }> = [];
    // console.log("existingData.values::", existingData.values);
    const uniqueKeyIndex = existingData?.values[0].indexOf('UniqueKey');
    // console.log("UniqueKey is at index:", uniqueKeyIndex);
    
    const existingKeys = new Set(
      existingData?.values
        ?.slice(1)  // Skip header row
        ?.map(row => {
          console.log("Row UniqueKey:", row[uniqueKeyIndex]); 
          return row[uniqueKeyIndex];
        })
        ?.filter(key => key) || []
    );
    
    // console.log("Sample candidate unique key:", batch[0]?.unique_key_string);

    
    // const existingKeys = new Set(
    //   existingData?.values
    //     ?.slice(1)
    //     ?.map(row => row[uniqueKeyIndex])
    //     ?.filter(key => key) || [],
    // );
    // console.log("existingKeys:::", existingKeys);
    // console.log("existingKeys leng:::", existingKeys.size);
    const newCandidates = batch.filter(candidate => candidate?.unique_key_string && !existingKeys.has(candidate.unique_key_string));
    console.log("New number of candidates ::", newCandidates.length);
    if (newCandidates.length > 0) {
      const currentHeaders = existingData?.values ? existingData.values[0] : [];
      console.log('This is the current headers:::', currentHeaders);
      const candidateRows = newCandidates.map(candidate => this.formatCandidateRow(candidate, currentHeaders));
      console.log('This is the candidateRows:::', candidateRows);
      const nextRow = (existingData?.values?.length || 0) + 1;
      updates.push({ range: `Sheet1!A${nextRow}`, values: candidateRows });
      console.log('This is the number of updates:::', updates.length);
      await this.batchUpdateGoogleSheet(auth, googleSheetId, updates);
      console.log(`Successfully appended ${candidateRows.length} new candidates to Google Sheet in appendNewCandidatesToSheet`);
    }
  }

  async findSpreadsheetByJobName(auth: any, jobName: string): Promise<{ id: string; url: string } | null> {
    console.log('looking for existing files');
    const drive = google.drive({ version: 'v3', auth });
    const searchQuery = `name = '${jobName} - Job Tracking' and mimeType = 'application/vnd.google-apps.spreadsheet'`;

    try {
      const response = await drive.files.list({
        q: searchQuery,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      const files = response.data.files;
      if (files && files.length > 0) {
        console.log('Existing file found');
        return {
          id: files[0].id ?? '',
          url: `https://docs.google.com/spreadsheets/d/${files[0].id}`,
        };
      }
      return null;
    } catch (error) {
      console.error('Error searching for spreadsheet:', error);
      throw error;
    }
  }

  private async retryWithBackoff<T>(operation: () => Promise<T>, maxRetries = 5, initialDelay = 1000): Promise<T> {
    let retries = 0;
    while (true) {
      try {
        return await operation();
      } catch (error) {
        if (!error.message?.includes('Quota exceeded') || retries >= maxRetries) {
          throw error;
        }

        const delay = initialDelay * Math.pow(2, retries);
        console.log(`Rate limit hit, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
      }
    }
  }

  private async expandSheetGrid(auth: any, spreadsheetId: string, newColumnCount: number): Promise<void> {
    const sheets = google.sheets({ version: 'v4', auth });

    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: 0, // Assuming first sheet
                  gridProperties: {
                    columnCount: newColumnCount,
                    rowCount: 1000, // Keep existing row count
                  },
                },
                fields: 'gridProperties(rowCount,columnCount)',
              },
            },
          ],
        },
      });
    } catch (error) {
      console.error('Error expanding sheet grid:', error);
      throw error;
    }
  }

  async updateIdsInSheet(auth: any, googleSheetId: string, tracking: { personIdMap: Map<string, string>; candidateIdMap: Map<string, string> }, apiToken: string): Promise<void> {
    try {
      // const sheets = google.sheets({ version: 'v4', auth });

      // Get existing data and headers
      const existingData = await this.getValues(auth, googleSheetId, 'Sheet1');
      console.log('existingData:::', existingData?.values);
      if (!existingData?.values?.length) {
        console.log('No data found in sheet');
        return;
      }

      const headers = existingData.values[0];
      // Calculate required columns
      const requiredColumns = Math.max(
        headers.length + 2, // Current columns + 2 new ones
        50, // Minimum columns to ensure space for future columns
      );
      console.log('headers::', headers);
      // Expand grid if needed
      await this.expandSheetGrid(auth, googleSheetId, requiredColumns);

      // Find or add required columns
      let personIdIndex = headers.findIndex(header => header === 'personId');
      let candidateIdIndex = headers.findIndex(header => header === 'candidateId');
      const uniqueKeyIndex = headers.findIndex(header => header.toLowerCase().includes('unique') && header.toLowerCase().includes('key'));

      // If columns don't exist, add them
      const updates: Array<{ range: string; values: string[][] }> = [];

      if (personIdIndex === -1) {
        personIdIndex = headers.length;
        headers.push('personId');
        // Update headers row with new column
        updates.push({
          range: `Sheet1!${this.getColumnLetter(personIdIndex)}1:${this.getColumnLetter(personIdIndex)}1`,
          values: [['personId']],
        });
      }

      if (candidateIdIndex === -1) {
        candidateIdIndex = headers.length;
        headers.push('candidateId');
        // Update headers row with new column
        updates.push({
          range: `Sheet1!${this.getColumnLetter(candidateIdIndex)}1:${this.getColumnLetter(candidateIdIndex)}1`,
          values: [['candidateId']],
        });
      }

      if (uniqueKeyIndex === -1) {
        console.log('No unique key column found in update ids in sheet');
        return;
      }

      console.log('Original number of rows in the sheet:', existingData.values.length);
      console.log('Total number of updates being pushed:', updates.length);
      console.log('Length of tracking.personIdMap:', tracking.personIdMap.size);
      console.log('Length of tracking.candidateIdMap:', tracking.candidateIdMap.size);
      console.log('This is the headers:::', headers);
      console.log('This is the existingData:::', existingData);
      console.log('This is the existingData:::', existingData.values.length);

      // Update IDs in their respective columns
      for (let i = 1; i < existingData.values.length; i++) {
        const row = existingData.values[i];
        const uniqueKey = row[uniqueKeyIndex];

        if (!uniqueKey) continue;

        const personId = tracking.personIdMap.get(uniqueKey);
        const candidateId = tracking.candidateIdMap.get(uniqueKey);
        const rowNumber = i + 1;

        if (personId) {
          updates.push({
            range: `Sheet1!${this.getColumnLetter(personIdIndex)}${rowNumber}:${this.getColumnLetter(personIdIndex)}${rowNumber}`,
            values: [[personId]],
          });
        }
        if (candidateId) {
          updates.push({
            range: `Sheet1!${this.getColumnLetter(candidateIdIndex)}${rowNumber}:${this.getColumnLetter(candidateIdIndex)}${rowNumber}`,
            values: [[candidateId]],
          });
        }
      }

      // Batch update the sheet
      if (updates.length > 0) {
        await this.batchUpdateGoogleSheet(auth, googleSheetId, updates);
        console.log(`Updated ${updates.length} ID entries in the sheet`);
      }
    } catch (error) {
      console.error('Error updating IDs in sheet:', error);
      throw error;
    }
  }

  async createSpreadsheetForJob(jobName: string, twentyToken: string): Promise<any> {
    const auth = await this.loadSavedCredentialsIfExist(twentyToken);
    if (!auth) {
      throw new Error('Failed to load authentication credentials');
    }

    try {
      const sheets = google.sheets({ version: 'v4', auth: auth as OAuth2Client });
      const spreadsheetTitle = `${jobName} - Job Tracking`;


      console.log('This is the rowDataValues:::', rowDataValues);
      // Create new spreadsheet with initial structure
      const newSpreadsheet = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: spreadsheetTitle,
          },
          sheets: [
            {
              properties: {
                sheetId: 0,
                title: 'Sheet1',
              },
              data: [
                {
                  startRow: 0,
                  startColumn: 0,
                  rowData: [ { values: rowDataValues, },
                  ],
                },
              ],
            },
          ],
        },
      });

      if (!newSpreadsheet.data.spreadsheetId) {
        throw new Error('Failed to create new spreadsheet');
      }
      // Copy the template spreadsheet
      // const copiedFile = await drive.files.copy({
      //   fileId: this.TEMPLATE_SPREADSHEET_ID,
      //   requestBody: {
      //     name: spreadsheetTitle,
      //   },
      // });

      // if (!copiedFile.data.id) {
      //   throw new Error('Failed to create spreadsheet from template');
      // }
      // // Create a new spreadsheet
      // Auto-resize columns to fit content
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: newSpreadsheet.data.spreadsheetId,
        requestBody: {
          requests: [
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId: 0,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: CandidateSourcingTypes.columnDefinitions.length,
                },
              },
            },
          ],
        },
      });

      // Freeze the top row
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: newSpreadsheet.data.spreadsheetId,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: 0,
                  gridProperties: {
                    frozenRowCount: 1,
                  },
                },
                fields: 'gridProperties.frozenRowCount',
              },
            },
          ],
        },
      });

      return {
        googleSheetId: newSpreadsheet.data.spreadsheetId,
        googleSheetUrl: `https://docs.google.com/spreadsheets/d/${newSpreadsheet.data.spreadsheetId}`,
      };
    } catch (error) {
      console.error('Error creating/finding spreadsheet:', error);
      throw error;
    }
  }

  async updateCandidateInSheet(auth: any, spreadsheetId: string, candidate: CandidateSourcingTypes.UserProfile, apiToken: string) {
    try {
      // Get existing headers and data
      const sheets = google.sheets({ version: 'v4', auth });
      const existingData = await this.getValues(auth, spreadsheetId, 'Sheet1');

      if (!existingData?.values?.[0]) {
        console.log('No headers found in sheet');
        return;
      }

      const headers = existingData.values[0];

      // Find candidate row by unique key
      const uniqueKeyIndex = headers.findIndex(header => header.toLowerCase().includes('unique') && header.toLowerCase().includes('key'));

      if (uniqueKeyIndex === -1) {
        console.log('No unique key column found in create spreadsheet');
        return;
      }

      // Find the row index of the candidate
      const rowIndex = existingData.values.findIndex(row => row[uniqueKeyIndex] === candidate.unique_key_string);

      if (rowIndex === -1) {
        console.log('Candidate not found in sheet');
        return;
      }

      // Format updated row data
      const updatedRowData = this.formatCandidateRow(candidate, headers);

      // Update the specific row
      await this.updateValues(
        auth,
        spreadsheetId,
        `Sheet1!A${rowIndex + 1}`, // +1 because rows are 1-based
        [updatedRowData],
        apiToken,
      );

      console.log('Successfully updated candidate in sheet');
    } catch (error) {
      console.error('Error updating candidate in sheet:', error);
      throw error;
    }
  }

  async loadSavedCredentialsIfExist(twenty_token: string) {
    const connectedAccountsResponse = await axios.request({
      method: 'get',
      url: 'http://localhost:3000/rest/connectedAccounts',
      headers: {
        authorization: 'Bearer ' + twenty_token,
        'content-type': 'application/json',
      },
    });

    console.log('connectedAccountsResponse:', connectedAccountsResponse.data);
    if (connectedAccountsResponse?.data?.data?.connectedAccounts?.length > 0) {
      const connectedAccountToUse = connectedAccountsResponse.data.data.connectedAccounts.filter(x => x.handle === process.env.EMAIL_SMTP_USER)[0];
      const refreshToken = connectedAccountToUse?.refreshToken;

      if (!refreshToken) return null;

      try {
        const credentials = {
          type: 'authorized_user',
          client_id: process.env.AUTH_GOOGLE_CLIENT_ID,
          client_secret: process.env.AUTH_GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
        };
        return google.auth.fromJSON(credentials);
      } catch (err) {
        console.log('Error loading credentials:', err);
      }
    }
  }

  async updateValues(auth, spreadsheetId: string, range: string, values: any[][], twenty_token: string) {
    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const response = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: {
          values,
        },
      });
      return response.data;
    } catch (error) {
      console.log('Sheets API Error in updateValues:', error.response?.data || error);
    }
  }

  async batchUpdateGoogleSheet(auth: any, spreadsheetId: string, updates: Array<{ range: string; values: any[][] }>): Promise<void> {
    return this.retryWithBackoff(async () => {
      const sheets = google.sheets({ version: 'v4', auth });
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates.map(update => ({
            range: update.range,
            values: update.values,
          })),
        },
      });
    });
  }
  async getValues(auth, spreadsheetId: string, range: string) {
    const sheets = google.sheets({ version: 'v4', auth });
    console.log('spreadsheetId::', spreadsheetId);

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      return response.data;
    } catch (error) {
      console.log('Sheets API Errorin get Values:', error.response?.data || error);
    }
  }
  async deleteSheet(auth, spreadsheetId: string) {
    const drive = google.drive({ version: 'v3', auth });
    try {
      await drive.files.delete({ fileId: spreadsheetId });
      return { success: true };
    } catch (error) {
      console.error('Drive API Error:', error.response?.data || error);
      throw error;
    }
  }
}
