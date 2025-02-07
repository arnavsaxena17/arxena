import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { createWriteStream } from 'fs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GoogleDriveService } from './google-drive.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { In } from 'typeorm';
import { google } from 'googleapis';
import { CallAndSMSProcessingService } from './call-sms-processing';
import { AttachmentProcessingService } from '../arx-chat/utils/attachment-processes';
import { workspacesWithOlderSchema } from '../candidate-sourcing/graphql-queries';
// const workspacesToIgnore = ["20202020-1c25-4d02-bf25-6aeccf7ea419","3b8e6458-5fc1-4e63-8563-008ccddaa6db"];

@Injectable()
export class CronDriveService {
 private readonly AUDIO_FOLDER_ID = '1CubFDsG9cyULQDYhpduxWUKTEkAeX-2i';
 private readonly XML_FOLDER_ID = '1b3tLqHSJvTRN-Szb-4pvrMo83FFcCm4d';
 private isProcessing = false;
    workspaceDataSourceService: WorkspaceQueryService;

 constructor(

    private readonly callSmsService: CallAndSMSProcessingService,
    private readonly driveService: GoogleDriveService,
    private attachmentService: AttachmentProcessingService,
    
   private readonly workspaceQueryService: WorkspaceQueryService
 ) {
    this.callSmsService = new CallAndSMSProcessingService(workspaceQueryService, attachmentService);

 }

 @Cron(CronExpression.EVERY_10_MINUTES)
 async fetchDriveFiles() {
    console.log("fetchDriveFiles()");
   if (this.isProcessing) {
     console.log('Previous drive sync still running, skipping');
     return;
   }

   try {
     this.isProcessing = true;
     const workspaceIds = await this.workspaceQueryService.getWorkspaces();
     const dataSources = await this.workspaceQueryService.dataSourceRepository.find({
       where: { workspaceId: In(workspaceIds) }
     });

     const workspaceIdsWithDataSources = new Set(
       dataSources.map(ds => ds.workspaceId)
     );
     const filteredWorkspaceIds = Array.from(workspaceIdsWithDataSources).filter(workspaceId => !workspacesWithOlderSchema.includes(workspaceId));
     for (const workspaceId of filteredWorkspaceIds) {
      const schema = this.workspaceQueryService.workspaceDataSourceService.getSchemaName(workspaceId);
       const apiKeys = await this.workspaceQueryService.getApiKeys(workspaceId, schema);

       if (apiKeys.length > 0) {
         const apiKeyToken = await this.workspaceQueryService.tokenService.generateApiKeyToken(
           workspaceId, 
           apiKeys[0].id,
           apiKeys[0].expiresAt
         );

         if (apiKeyToken) {
           const auth = await this.driveService.loadSavedCredentialsIfExist(apiKeyToken.token);
           const [audioFiles, xmlFiles] = await Promise.all([
             this.driveService.listFiles(auth, this.AUDIO_FOLDER_ID),
             this.driveService.listFiles(auth, this.XML_FOLDER_ID)
           ]);

           if (audioFiles && xmlFiles) {
             await this.processWorkspaceFiles(workspaceId, audioFiles, xmlFiles, apiKeyToken.token);
           }
         }
       }
     }
   } catch (error) {
     console.log('Drive sync error:', error.message);
   } finally {
     this.isProcessing = false;
   }
 }


 // In workspace query service
async getWorkspaceCallsFolder(workspaceId: string, dataSourceSchema: string): Promise<string> {
    const baseDir = process.env.GOOGLE_DRIVE_DATA_DIR || './google-drive-data';
    return `${baseDir}/${workspaceId}/calls`;
   }
   
async getWorkspaceSMSFolder(workspaceId: string, dataSourceSchema: string): Promise<string> {
const baseDir = process.env.GOOGLE_DRIVE_DATA_DIR || './google-drive-data';
return `${baseDir}/${workspaceId}/sms`; 
}

async getWorkspaceRecordingsFolder(workspaceId: string, dataSourceSchema: string): Promise<string> {
const baseDir = process.env.GOOGLE_DRIVE_DATA_DIR || './google-drive-data';
return `${baseDir}/${workspaceId}/recordings`;
}


private async processWorkspaceFiles(workspaceId: string, audioFiles: any[], xmlFiles: any[], apiKeyToken: string) {
    const auth = await this.driveService.loadSavedCredentialsIfExist(apiKeyToken);

    const dataSourceSchema = this.workspaceQueryService.workspaceDataSourceService.getSchemaName(workspaceId);
    
    // Get data folders from workspace config/settings
    const callsFolder = await this.getWorkspaceCallsFolder(workspaceId, dataSourceSchema);
    const smsFolder = await this.getWorkspaceSMSFolder(workspaceId, dataSourceSchema);
    const recordingsFolder = await this.getWorkspaceRecordingsFolder(workspaceId, dataSourceSchema);

    // Process files
    for (const file of xmlFiles) {
        if (file.name.startsWith('calls-')) {
            await this.downloadFileIfNotExists(auth, file.id, callsFolder, file.name);

            await this.callSmsService.processCallsAndSMS(
                `${callsFolder}/${file.name}`,
                `${smsFolder}/${file.name.replace('calls-', 'sms-')}`,
                recordingsFolder,
                apiKeyToken
              );
      
        } else if (file.name.startsWith('sms-')) {
            await this.downloadFileIfNotExists(auth, file.id, smsFolder, file.name);
            await this.callSmsService.processCallsAndSMS(
                `${callsFolder}/calls-${file.name.substring(4)}`, // Get corresponding calls file
                `${smsFolder}/${file.name}`,
                recordingsFolder, 
                apiKeyToken
              );
            
        }
    }

    for (const file of audioFiles) {
        await this.downloadFileIfNotExists(auth, file.id, recordingsFolder, file.name);
    }
}

async downloadFileIfNotExists(auth: any, fileId: string, destPath: string, fileName: string) {
    const filePath = `${destPath}/${fileName}`;
    try {
        await fs.promises.access(filePath, fs.constants.F_OK);
        console.log(`File ${fileName} already exists, skipping download.`);
    } catch (error) {
        // File does not exist, proceed with download
        await this.downloadFile(auth, fileId, destPath);
    }
}

async downloadFile(auth: any, fileId: string, destPath: string) {
    console.log(`Downloading file ${fileId}`);
    const drive = google.drive({ version: 'v3', auth });
    const fileMetadata = await drive.files.get({ fileId, fields: 'name' });
    const fileName = fileMetadata.data.name;
    const file = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
    await fs.promises.mkdir(destPath, { recursive: true });
    const dest = createWriteStream(`${destPath}/${fileName}`);

    return new Promise((resolve, reject) => {
        file.data
            .pipe(dest)
            .on('finish', resolve)
            .on('error', reject);
    });
}
}