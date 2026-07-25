import {
    Body,
    Controller,
    HttpException,
    HttpStatus,
    Logger,
    Post,
    Req,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { ProcessResumeUploadsService } from '../jobs/process-resume-uploads.service';
import { ResumeReadParseUploadService } from '../services/resume-read-parse-upload.service';

export class ResumeUploadDto {
  projectId: string;
  jobName: string;
}

@Controller('resume-upload')
@UseGuards(JwtAuthGuard)
export class ResumeUploadController {
  private readonly logger = new Logger(ResumeUploadController.name);

  constructor(
    private readonly resumeReadParseUploadService: ResumeReadParseUploadService,
    private readonly processResumeUploadsService: ProcessResumeUploadsService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  @Post()
  @UseInterceptors(FilesInterceptor('resume', 10)) // Allow up to 10 files
  async uploadResumes(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: ResumeUploadDto,
    @Req() request: any,
  ) {
    this.logger.log(`Received ${files?.length || 0} resume files for upload`);

    if (!files || files.length === 0) {
      throw new HttpException('No files uploaded', HttpStatus.BAD_REQUEST);
    }

    if (!body.projectId || !body.jobName) {
      throw new HttpException('projectId and jobName are required', HttpStatus.BAD_REQUEST);
    }

    // Validate file types
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];

    const invalidFiles = files.filter(
      file => !supportedTypes.includes(file.mimetype) && 
      !file.originalname.match(/\.(pdf|docx|doc)$/i)
    );

    if (invalidFiles.length > 0) {
      throw new HttpException(
        `Invalid file types. Only PDF, DOCX, and DOC files are supported. Invalid files: ${invalidFiles.map(f => f.originalname).join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      // Save uploaded files to temporary directory
      const filePaths = await this.resumeReadParseUploadService.saveUploadedFiles(
        files,
        body.projectId,
      );

      // Extract user info from request
      const userId = request.user?.id || 'unknown';
      
      // Debug request headers
      this.logger.log(`Resume upload - Authorization header: ${request.headers.authorization}`);
      this.logger.log(`Resume upload - All headers keys: ${Object.keys(request.headers).join(', ')}`);
      
      const apiToken = request.headers.authorization?.split(' ')[1]?.replace(/[\r\n]+/g, '') || '';
      
      this.logger.log(`Resume upload - API token length: ${apiToken?.length}`);
      this.logger.log(`Resume upload - User ID: ${userId}`);

      // Get workspace member ID for progress reporting (same as SSE connection)
      let workspaceMemberId = userId; // fallback to user ID
      const originHeader = request.headers['x-origin-domain'];
      const originFromOriginHeader = request.headers.origin;
      const originFromReferer = request.headers.referer;
      const origin =
        originHeader ||
        originFromOriginHeader ||
        originFromReferer ||
        'unknown';

      this.logger.log(
        `Resume upload - Origin resolved: ${JSON.stringify({
          resolved: origin,
          source: originHeader
            ? 'headers[x-origin-domain]'
            : originFromOriginHeader
              ? 'headers[origin]'
              : originFromReferer
                ? 'headers[referer]'
                : 'fallback[unknown]',
          raw: {
            'x-origin-domain': originHeader,
            origin: originFromOriginHeader,
            referer: originFromReferer,
          },
        })}`,
      );
      try {
        this.logger.log(`Resume upload - Calling getCurrentUser with origin: ${origin}`);
        const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
        workspaceMemberId = currentUser?.workspaceMember?.id || userId;
        this.logger.log(`Resume upload - Workspace Member ID: ${workspaceMemberId}`);
      } catch (userError) {
        this.logger.warn('Could not get workspace member ID for progress reporting:', userError.message);
      }

      // Queue the resume files for processing
      await this.processResumeUploadsService.queueResumeUpload(
        filePaths,
        body.projectId,
        body.jobName,
        workspaceMemberId, // Use workspace member ID for progress reporting
        origin,
        apiToken,
      );

      this.logger.log(`Resume upload queued for processing: ${filePaths.length} files`);

      return {
        success: true,
        message: `Successfully queued ${filePaths.length} resume files for processing`,
        processedCount: 0,
        errorCount: 0,
        errors: [],
      };

    } catch (error) {
      this.logger.error('Error processing resume upload:', error);
      throw new HttpException(
        `Failed to process resume upload: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
