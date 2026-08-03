// google-drive.service.ts
import { Injectable } from "@nestjs/common";
import { google } from "googleapis";
import { GoogleConnectedAccountAuthService } from "src/engine/core-modules/google-auth/google-connected-account-auth.service";

@Injectable()
export class GoogleDriveService {
  constructor(
    private readonly googleConnectedAccountAuthService: GoogleConnectedAccountAuthService,
  ) {}

  async loadSavedCredentialsIfExist(twenty_token: string) {
    return this.googleConnectedAccountAuthService.loadGoogleOAuth2ClientFromToken(
      twenty_token,
      process.env.EMAIL_SMTP_USER,
    );
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
