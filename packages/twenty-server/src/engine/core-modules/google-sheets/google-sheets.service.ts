// google-sheets.service.ts
import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import axios from 'axios';
import * as CandidateSourcingTypes from 'src/engine/core-modules/candidate-sourcing/types/candidate-sourcing-types';
import { OAuth2Client } from 'google-auth-library';
import { UpdateOneJob } from '../candidate-sourcing/graphql-queries';
import { axiosRequest } from '../workspace-modifications/workspace-modifications.controller';

@Injectable()
export class GoogleSheetsService {
  private oauth2Client;

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

  
  
  private async formatHeadersBold(auth: any, spreadsheetId: string, headerLength: number): Promise<void> {
    const sheets = google.sheets({ version: 'v4', auth });
    const lastColumn = this.getColumnLetter(headerLength - 1);

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
      console.error('Error formatting headers:', error);
    }
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
    await this.formatHeadersBold(auth, spreadsheetId, updatedHeaders.length);
  }

  private async initializeSheetIfNeeded(auth: any, googleSheetId: string, newHeaders: string[], existingData: any, apiToken: string): Promise<void> {
    const sheets = google.sheets({ version: 'v4', auth });

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


    // Use addMissingHeaders instead of implementing the logic directly
    await this.addMissingHeaders(auth, googleSheetId, existingHeaders, newHeaders, apiToken);
  

    // Find new headers that don't exist in the current sheet
    const newColumnsToAdd = newHeaders.filter(header => !existingHeaders.includes(header));

    if (newColumnsToAdd.length > 0) {
      console.log('Adding new columns:', newColumnsToAdd);

      // Add new columns to existing headers
      const updatedHeaders = [...existingHeaders, ...newColumnsToAdd];

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

  private formatCandidateRow(candidate: CandidateSourcingTypes.UserProfile, headers: string[]): string[] {
    return headers.map(header => {
      const definition = CandidateSourcingTypes.columnDefinitions.find(col => col.header === header);
      if (!definition) {
        // Handle screening questions
        if (header.includes('?')) {
          const ansKey = `Ans(${header})`;
          return candidate[ansKey] || '';
        }
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
    try {
      const auth = await this.loadSavedCredentialsIfExist(apiToken);

      if (!auth) {
        console.log('Google Sheets authentication failed');
        return;
      }
      const headers = this.getHeadersFromData(batch);
      console.log('Headers:', headers);
      const lastColumn = this.getColumnLetter(headers.length - 1);
      console.log('This is the last column:', lastColumn);
      // Get existing data
      console.log('Looking for jobObject.name::', jobObject.name);
      const existingSheet = await this.findSpreadsheetByJobName(auth, jobObject.name);
      console.log('This is the existing sheet:', existingSheet, 'googleSheetId:', googleSheetId);
      if (!existingSheet) {
        console.log('Spreadsheet does not exist, creating new one');
        const newSheet = await this.createSpreadsheetForJob(jobObject.name, apiToken);
        googleSheetId = newSheet.googleSheetId;
        const googleSheetUrl = `https://docs.google.com/spreadsheets/d/${googleSheetId}`;
        this.updateJobWithSheetDetails(jobObject, googleSheetUrl, googleSheetId, apiToken);
      }
      const existingData = await this.getValues(auth, googleSheetId, `Sheet1!A1:${lastColumn}`);
      console.log('This is the existing data:', existingData);
      await this.initializeSheetIfNeeded(auth, googleSheetId, headers, existingData, apiToken);
      console.log('Initialised sheet data:');
      await this.appendNewCandidates(auth, googleSheetId, batch, headers, existingData, apiToken);
      console.log('Appended new candidates');
    } catch (error) {
      console.log('Error in process Google Sheet Batch:', error);
      if (error.response?.data) {
        console.error('Detailed error:', error.response.data);
      }
    }
  }

  private getHeadersFromData(data: CandidateSourcingTypes.UserProfile[]): string[] {
    if (!data || data.length === 0) {
      return ['status', 'notes', 'unique_key_string', 'full_name', 'email_address', 'phone_numbers'];
    }

    const sampleCandidate = data[0];
    const headers = new Set<string>();

    // Add headers based on available data
    Object.keys(sampleCandidate).forEach(key => {
      headers.add(key);
    });

    // Add screening questions that start with 'Ans'
    const ansKeys = Object.keys(sampleCandidate).filter(key => key.startsWith('Ans'));
    ansKeys.forEach(key => {
      const questionText = key.replace('Ans(', '').replace(')', '');
      headers.add(questionText);
    });

    return Array.from(headers);
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


  async createSpreadsheetForJob(jobName: string, twentyToken: string): Promise<any> {
    const auth = await this.loadSavedCredentialsIfExist(twentyToken);
    if (!auth) {
      throw new Error('Failed to load authentication credentials');
    }
  
    try {  
      const sheets = google.sheets({ version: 'v4', auth: auth as OAuth2Client });
      const spreadsheetTitle = `${jobName} - Job Tracking`;

      // Create new spreadsheet with initial structure
      const newSpreadsheet = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
        title: spreadsheetTitle,
          },
          sheets: [{
        properties: {
          sheetId: 0,
          title: 'Sheet1',
        },
        data: [{
          startRow: 0,
          startColumn: 0,
          rowData: [{
            values: [
          ...CandidateSourcingTypes.columnDefinitions.map(col => ({
            userEnteredValue: { stringValue: col.header },
            userEnteredFormat: {
              textFormat: { bold: true }
            }
          })),
          { userEnteredValue: { stringValue: 'engagementStatus' }, userEnteredFormat: { textFormat: { bold: true } } },
          { userEnteredValue: { stringValue: 'startChat' }, userEnteredFormat: { textFormat: { bold: true } } },
          { userEnteredValue: { stringValue: 'startVideoInterviewChat' }, userEnteredFormat: { textFormat: { bold: true } } },
          { userEnteredValue: { stringValue: 'startMeetingSchedulingChat' }, userEnteredFormat: { textFormat: { bold: true } } },
          { userEnteredValue: { stringValue: 'stopChat' }, userEnteredFormat: { textFormat: { bold: true } } }
            ]
          }]
        }]
          }]
        }
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
          requests: [{
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: CandidateSourcingTypes.columnDefinitions.length
              }
            }
          }]
        }
      });

      // Freeze the top row
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: newSpreadsheet.data.spreadsheetId,
        requestBody: {
          requests: [{
        updateSheetProperties: {
          properties: {
            sheetId: 0,
            gridProperties: {
          frozenRowCount: 1
            }
          },
          fields: 'gridProperties.frozenRowCount'
        }
          }]
        }
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
      const uniqueKeyIndex = headers.findIndex(header => 
        header.toLowerCase().includes('unique') && header.toLowerCase().includes('key')
      );
      
      if (uniqueKeyIndex === -1) {
        console.log('No unique key column found');
        return;
      }
  
      // Find the row index of the candidate
      const rowIndex = existingData.values.findIndex(row => 
        row[uniqueKeyIndex] === candidate.unique_key_string
      );
  
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
        apiToken
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
