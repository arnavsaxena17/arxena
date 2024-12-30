// google-drive.controller.ts
import { Controller, Get, Post,Headers, Delete, Body, Param, Query, UseGuards, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GoogleDriveService } from './google-drive.service';
// import { GoogleAPIsRequest } from '../auth/google-apis.strategy';
import { GoogleAPIsRequest } from 'src/engine/core-modules/auth/strategies/google-apis.auth.strategy';
import { AuthGuard } from '@nestjs/passport';

@Controller('drive')
export class GoogleDriveController {
 constructor(private readonly driveService: GoogleDriveService) {}

 @Get('files')

 async listFiles(
@Headers('authorization') authHeader: string,
   @Query('folderId') folderId?: string,
   @Query('pageSize') pageSize?: number,
 ) {
    console.log("Got here")
    const twentyToken = authHeader.replace('Bearer ', '');

   const auth = await this.driveService.loadSavedCredentialsIfExist(twentyToken);
   return this.driveService.listFiles(auth, folderId, pageSize);
 }

 @Post('upload')
 @UseInterceptors(FileInterceptor('file'))
 async uploadFile(
    @Headers('authorization') authHeader: string,
    @UploadedFile() file: Express.Multer.File,
   @Body('folderId') folderId?: string,
 ) {
    const twentyToken = authHeader.replace('Bearer ', '');

   const auth = await this.driveService.loadSavedCredentialsIfExist(twentyToken);
   return this.driveService.uploadFile(auth, {
     name: file.originalname,
     mimeType: file.mimetype,
     content: file.buffer,
     folderId,
   });
 }

 @Post('folders')
 async createFolder(
    @Headers('authorization') authHeader: string,
    @Body('name') name: string,
   @Body('parentFolderId') parentFolderId?: string,
 ) {
    const twentyToken = authHeader.replace('Bearer ', '');

   const auth = await this.driveService.loadSavedCredentialsIfExist(twentyToken);
   return this.driveService.createFolder(auth, { name, parentFolderId });
 }

 @Post('copy/:fileId')
 async copyFile(
    @Headers('authorization') authHeader: string,
    @Param('fileId') fileId: string,
   @Body('destinationFolderId') destinationFolderId?: string,
 ) {
    const twentyToken = authHeader.replace('Bearer ', '');

   const auth = await this.driveService.loadSavedCredentialsIfExist(twentyToken);
   return this.driveService.copyFile(auth, fileId, destinationFolderId);
 }

 @Delete(':fileId')
 async deleteFile(
    @Headers('authorization') authHeader: string,
    @Param('fileId') fileId: string,
 ) {
    const twentyToken = authHeader.replace('Bearer ', '');

   const auth = await this.driveService.loadSavedCredentialsIfExist(twentyToken);
   return this.driveService.deleteFile(auth, fileId);
 }
}