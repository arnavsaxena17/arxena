// google-sheets.service.ts
import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import axios from 'axios';
import * as CandidateSourcingTypes from 'src/engine/core-modules/candidate-sourcing/types/candidate-sourcing-types';

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

  private async initializeSheetIfNeeded(auth: any, googleSheetId: string, headers: string[], existingData: any, apiToken: string): Promise<void> {
    // Initialize sheet with headers if completely empty
    if (!existingData || !existingData.values) {
      console.log('Sheet is empty, initializing with headers');
      await this.updateValues(auth, googleSheetId, 'Sheet1!A1', [headers], apiToken);
      existingData.values = [headers];
    }
    // If sheet has data but no headers, insert headers
    else if (existingData.values.length === 0) {
      console.log('Sheet has no headers, inserting headers');
      await this.updateValues(auth, googleSheetId, 'Sheet1!A1', [headers], apiToken);
      existingData.values = [headers];
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

    const candidateRows = newCandidates.map(candidate => this.formatCandidateRow(candidate, headers));

    // Append new candidates
    const nextRow = existingData.values.length + 1;
    await this.updateValues(auth, googleSheetId, `Sheet1!A${nextRow}`, candidateRows, apiToken);

    console.log(`Successfully appended ${candidateRows.length} new candidates to Google Sheet`);
  }

  async processGoogleSheetBatch(batch: CandidateSourcingTypes.UserProfile[], results: any, tracking: any, apiToken: string, googleSheetId: string): Promise<void> {
    try {
      const auth = await this.loadSavedCredentialsIfExist(apiToken);

      if (!auth) {
        console.log('Google Sheets authentication failed');
        return;
      }
      const headers = this.getHeadersFromData(batch);
      const lastColumn = this.getColumnLetter(headers.length - 1);
      // Get existing data
      const existingData = await this.getValues(auth, googleSheetId, `Sheet1!A1:${lastColumn}`);
      await this.initializeSheetIfNeeded(auth, googleSheetId, headers, existingData, apiToken);
      await this.appendNewCandidates(auth, googleSheetId, batch, headers, existingData, apiToken);
    } catch (error) {
      console.log('Error in processGoogleSheetBatch:', error);
      if (error.response?.data) {
        console.error('Detailed error:', error.response.data);
      }
    }
  }
  private getHeadersFromData(data: CandidateSourcingTypes.UserProfile[]): string[] {
    if (!data || data.length === 0) {
      return CandidateSourcingTypes.columnDefinitions.slice(0, 4).map(col => col.header);
    }

    const sampleCandidate = data[0];
    const headers = new Set<string>();

    // Add headers based on available data
    CandidateSourcingTypes.columnDefinitions.forEach(def => {
      if (def.key === 'status' || def.key === 'notes' || def.key === 'unique_key_string' || def.key === 'full_name' || def.key === 'email_address' || def.key === 'phone_numbers' || sampleCandidate[def.key] !== undefined) {
        headers.add(def.header);
      }
    });

    // Add screening questions
    const ansKeys = Object.keys(sampleCandidate).filter(key => key.startsWith('Ans'));
    ansKeys.forEach(key => {
      const questionText = key.replace('Ans(', '').replace(')', '');
      headers.add(questionText);
    });

    return Array.from(headers);
  }

  async createSpreadsheetForJob(jobName: string, twentyToken: string): Promise<any> {
    const auth = await this.loadSavedCredentialsIfExist(twentyToken);

    const spreadsheetTitle = `${jobName} - Job Tracking`;
    const spreadsheet = await this.createSpreadsheet(auth, spreadsheetTitle);

    // Initialize the spreadsheet with headers
    const headers = [['Candidate Name', 'Email', 'Phone', 'Current Company', 'Current Title', 'Status', 'Notes']];

    console.log('Gong to create sheeet headers');
    if (spreadsheet?.spreadsheetId) {
      await this.updateValues(auth, spreadsheet?.spreadsheetId, 'Sheet1!A1:G1', headers, twentyToken);
    } else {
      throw new Error('Spreadsheet ID is undefined');
    }
    console.log('This is the spreadsheet::', spreadsheet);
    return {
      googleSheetId: spreadsheet.spreadsheetId,
      googleSheetUrl: 'https://docs.google.com/spreadsheets/d/' + spreadsheet.spreadsheetId,
    };
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

  async createSpreadsheet(auth, title: string) {
    const sheets = google.sheets({ version: 'v4', auth });

    const resource = {
      properties: {
        title,
      },
    };

    try {
      const response = await sheets.spreadsheets.create({
        requestBody: resource,
        fields: 'spreadsheetId,properties.title,sheets.properties',
      });
      console.log('Spreadsheet created:', response.data);
      return response.data;
    } catch (error) {
      console.log('Sheets API Error:', error.response?.data || error);
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
      console.log('Sheets API Error:', error.response?.data || error);
    }
  }

  async getValues(auth, spreadsheetId: string, range: string) {
    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      return response.data;
    } catch (error) {
      console.error('Sheets API Error:', error.response?.data || error);
      throw error;
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
