// google-sheets.service.ts
import { Injectable } from "@nestjs/common";
import { google } from "googleapis";
import axios from "axios";

@Injectable()
export class GoogleSheetsService {
  private oauth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_CLIENT_ID,
      process.env.AUTH_GOOGLE_CLIENT_SECRET,
      process.env.AUTH_GOOGLE_CALLBACK_URL
    );
  }

  async loadSavedCredentialsIfExist(twenty_token: string) {
    const connectedAccountsResponse = await axios.request({
      method: "get",
      url: "http://localhost:3000/rest/connectedAccounts",
      headers: {
        authorization: "Bearer " + twenty_token,
        "content-type": "application/json",
      },
    });

    if (connectedAccountsResponse?.data?.data?.connectedAccounts?.length > 0) {
      const connectedAccountToUse = connectedAccountsResponse.data.data.connectedAccounts
        .filter(x => x.handle === process.env.EMAIL_SMTP_USER)[0];
      const refreshToken = connectedAccountToUse?.refreshToken;
      
      if (!refreshToken) return null;

      try {
        const credentials = {
          type: "authorized_user",
          client_id: process.env.AUTH_GOOGLE_CLIENT_ID,
          client_secret: process.env.AUTH_GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
        };
        return google.auth.fromJSON(credentials);
      } catch (err) {
        console.error("Error loading credentials:", err);
        return null;
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

  async updateValues(auth, spreadsheetId: string, range: string, values: any[][]) {
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
      console.error('Sheets API Error:', error.response?.data || error);
      throw error;
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