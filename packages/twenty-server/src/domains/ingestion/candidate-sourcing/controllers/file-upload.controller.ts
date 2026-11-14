import { BadRequestException, Controller, InternalServerErrorException, Post, Req, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as multer from 'multer';
import * as path from 'path';

@Controller('candidate-sourcing/file-upload')
export class FileUploadController {
  @Post('upload')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 }
      ],
      {
        storage: multer.diskStorage({
          destination: (req, file, callback) => {
            try {
              console.log(`[File-Upload] Received file: ${file.originalname}`);
              console.log('[File-Upload] File details:', {
                fieldname: file.fieldname,
                originalname: file.originalname,
                encoding: file.encoding,
                mimetype: file.mimetype
              });
              
              // Use absolute path
              const uploadPath = path.resolve(process.cwd(), 'uploads', 'files');
              console.log('[File-Upload] Upload path:', uploadPath);
              
              if (!fs.existsSync(uploadPath)) {
                console.log(`[File-Upload] Creating directory: ${uploadPath}`);
                fs.mkdirSync(uploadPath, { recursive: true });
                console.log(`[File-Upload] Created directory: ${uploadPath}`);
              }
              
              // Verify directory is writable
              try {
                fs.accessSync(uploadPath, fs.constants.W_OK);
                console.log('[File-Upload] Directory is writable');
              } catch (err) {
                console.error('[File-Upload] Directory is not writable:', err);
                return callback(new Error('Upload directory is not writable'), '');
              }
              
              callback(null, uploadPath);
            } catch (error) {
              console.error('[File-Upload] Error in destination handler:', error);
              callback(error, '');
            }
          },
          filename: (req, file, callback) => {
            try {
              const timestamp = Date.now();
              const originalName = file.originalname.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
              const ext = file.originalname.split('.').pop() || '';
              const finalName = `${originalName}_${timestamp}.${ext}`;
              console.log('[File-Upload] Generated filename:', finalName);
              callback(null, finalName);
            } catch (error) {
              console.error('[File-Upload] Error in filename handler:', error);
              callback(error, '');
            }
          }
        }),
        limits: {
          fileSize: 50 * 1024 * 1024, // 50MB
          files: 1
        },
        fileFilter: (req, file, callback) => {
          try {
            console.log('[File-Upload] Filtering file:', {
              fieldname: file.fieldname,
              originalname: file.originalname,
              mimetype: file.mimetype
            });
            
            // Accept all file types for now
            callback(null, true);
          } catch (error) {
            console.error('[File-Upload] Error in file filter:', error);
            callback(error, false);
          }
        }
      },
    ),
  )
  async uploadFile(@Req() request: any) {
    try {
      console.log('[File-Upload] Request body:', request.body);
      console.log('[File-Upload] Files in request:', request.files);
      
      if (!request.files) {
        console.error('[File-Upload] No files object in request');
        throw new BadRequestException('No files in request');
      }
      
      const file = request.files?.file?.[0];
      
      if (!file) {
        console.error('[File-Upload] No file found in request');
        throw new BadRequestException('No file uploaded');
      }

      console.log('[File-Upload] Successfully processed file:', {
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype
      });

      return {
        status: 'success',
        message: 'File uploaded successfully',
        data: {
          filename: file.filename,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype
        }
      };

    } catch (error) {
      console.error('[File-Upload] Error processing request:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: error.message || 'Failed to process file upload',
        error: error.toString()
      });
    }
  }
}
