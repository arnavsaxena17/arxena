// google-drive.service.ts
import { Injectable } from "@nestjs/common";
import { google } from "googleapis";
import axios from "axios";
import { promises as fs } from "fs";

@Injectable()
export class GoogleDriveService {
  private oauth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_CLIENT_ID,
      process.env.AUTH_GOOGLE_CLIENT_SECRET,
      process.env.AUTH_GOOGLE_CALLBACK_URL
    );
  }

  async loadSavedCredentialsIfExist(twenty_token: string) {
    console.log("loadSavedCredentialsIfExist");
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
    else{
        console.log("No connected accounts found");
    }
  }

  async listFiles(auth, folderId?: string, pageSize?: number) {
    const drive = google.drive({ version: 'v3', auth });
    
    // Only include pageSize in params if it's a valid number
    const params: any = {
        fields: 'nextPageToken, files(id, name, mimeType, createdTime, modifiedTime, size, parents)',
    };

    // Only add pageSize if it's a valid number
    if (typeof pageSize === 'number' && !isNaN(pageSize)) {
        params.pageSize = pageSize;
    }

    if (folderId) {
        params.q = `'${folderId}' in parents`;
    }

    try {
        const response = await drive.files.list(params);
        return response.data.files;
    } catch (error) {
        console.log('Drive API Error:', error.response?.data || error);
    }
}


  async uploadFile(auth, fileData: {
    name: string,
    mimeType: string,
    content: Buffer,
    folderId?: string
  }) {
    const drive = google.drive({ version: 'v3', auth });
    
    const fileMetadata = {
      name: fileData.name,
      parents: fileData.folderId ? [fileData.folderId] : undefined
    };

    const media = {
      mimeType: fileData.mimeType,
      body: fileData.content
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, mimeType, createdTime, modifiedTime, size, webViewLink'
    });

    return response.data;
  }

  async createFolder(auth, folderData: {
    name: string,
    parentFolderId?: string
  }) {
    const drive = google.drive({ version: 'v3', auth });
    
    const fileMetadata = {
      name: folderData.name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: folderData.parentFolderId ? [folderData.parentFolderId] : undefined
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id, name, mimeType, createdTime, webViewLink'
    });

    return response.data;
  }

  async copyFile(auth, fileId: string, destinationFolderId?: string) {
    const drive = google.drive({ version: 'v3', auth });
    
    const fileMetadata = destinationFolderId ? {
      parents: [destinationFolderId]
    } : {};

    const response = await drive.files.copy({
      fileId: fileId,
      requestBody: fileMetadata,
      fields: 'id, name, mimeType, createdTime, modifiedTime, size, webViewLink'
    });

    return response.data;
  }

  async deleteFile(auth, fileId: string) {
    const drive = google.drive({ version: 'v3', auth });
    await drive.files.delete({ fileId });
    return { success: true };
  }
}