// google-drive.controller.ts
import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GoogleDriveService } from './google-drive.service';
// import { GoogleAPIsRequest } from '../auth/google-apis.strategy';
import { GoogleAPIsRequest } from 'src/engine/core-modules/auth/strategies/google-apis.auth.strategy';
import { AuthGuard } from '@nestjs/passport';

@Controller('drive')
@UseGuards(AuthGuard('google-apis'))
export class GoogleDriveController {
 constructor(private readonly driveService: GoogleDriveService) {}

 @Get('files')
 async listFiles(
   @Req() req: GoogleAPIsRequest,
   @Query('folderId') folderId?: string,
   @Query('pageSize') pageSize?: number,
 ) {
   const auth = await this.driveService.loadSavedCredentialsIfExist(req.user.transientToken);
   return this.driveService.listFiles(auth, folderId, pageSize);
 }

 @Post('upload')
 @UseInterceptors(FileInterceptor('file'))
 async uploadFile(
   @Req() req: GoogleAPIsRequest,
   @UploadedFile() file: Express.Multer.File,
   @Body('folderId') folderId?: string,
 ) {
   const auth = await this.driveService.loadSavedCredentialsIfExist(req.user.transientToken);
   return this.driveService.uploadFile(auth, {
     name: file.originalname,
     mimeType: file.mimetype,
     content: file.buffer,
     folderId,
   });
 }

 @Post('folders')
 async createFolder(
   @Req() req: GoogleAPIsRequest,
   @Body('name') name: string,
   @Body('parentFolderId') parentFolderId?: string,
 ) {
   const auth = await this.driveService.loadSavedCredentialsIfExist(req.user.transientToken);
   return this.driveService.createFolder(auth, { name, parentFolderId });
 }

 @Post('copy/:fileId')
 async copyFile(
   @Req() req: GoogleAPIsRequest,
   @Param('fileId') fileId: string,
   @Body('destinationFolderId') destinationFolderId?: string,
 ) {
   const auth = await this.driveService.loadSavedCredentialsIfExist(req.user.transientToken);
   return this.driveService.copyFile(auth, fileId, destinationFolderId);
 }

 @Delete(':fileId')
 async deleteFile(
   @Req() req: GoogleAPIsRequest,
   @Param('fileId') fileId: string,
 ) {
   const auth = await this.driveService.loadSavedCredentialsIfExist(req.user.transientToken);
   return this.driveService.deleteFile(auth, fileId);
 }
}