import {
  Controller,
  Get,
  Logger,
  Param,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import { pipeline } from 'node:stream/promises';
import { join } from 'path';
import { type Readable } from 'stream';

import { Request, Response } from 'express';
import { lookup as mimeLookup } from 'mime-types';
import { FileFolder, ServerFileFolder } from 'twenty-shared/types';

import { FileStorageDriverFactory } from 'src/engine/core-modules/file-storage/file-storage-driver.factory';
import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import {
  FileStorageException,
  FileStorageExceptionCode,
} from 'src/engine/core-modules/file-storage/interfaces/file-storage-exception';
import { ServerFileStorageService } from 'src/engine/core-modules/file-storage/services/server-file-storage.service';
import { validateFilePath } from 'src/engine/core-modules/file-storage/utils/validate-file-path.util';
import {
  FileException,
  FileExceptionCode,
} from 'src/engine/core-modules/file/file.exception';
import { PUBLIC_ASSET_CACHE_CONTROL } from 'src/engine/core-modules/file/interfaces/file-folder.interface';
import { FileApiExceptionFilter } from 'src/engine/core-modules/file/filters/file-api-exception.filter';
import {
  FileByIdGuard,
  SupportedFileFolder,
} from 'src/engine/core-modules/file/guards/file-by-id.guard';
import { FileService } from 'src/engine/core-modules/file/services/file.service';
import { setFileResponseHeaders } from 'src/engine/core-modules/file/utils/set-file-response-headers.utils';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';

@Controller()
@UseFilters(FileApiExceptionFilter)
export class FileController {
  private readonly logger = new Logger(FileController.name);

  constructor(
    private readonly fileService: FileService,
    private readonly fileStorageDriverFactory: FileStorageDriverFactory,
    private readonly jwtWrapperService: JwtWrapperService,
    private readonly serverFileStorageService: ServerFileStorageService,
  ) {}

  // Serves application registration assets (logo, gallery images) by their
  // public folder path. These are instance-global marketplace resources, also
  // displayed on the public OAuth authorize page, hence no auth token, unlike
  // the workspace-scoped /file/:folder/:id.
  @Get('files/application-registrations/:applicationRegistrationId/*path')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async getApplicationRegistrationAsset(
    @Res() res: Response,
    @Req() req: Request,
    @Param('applicationRegistrationId') applicationRegistrationId: string,
  ) {
    const filepath = join(...req.params.path);

    let fileResponse: { stream: Readable; mimeType: string };

    try {
      fileResponse = await this.serverFileStorageService.readServerFile({
        fileFolder: ServerFileFolder.ApplicationRegistration,
        applicationRegistrationId,
        resourcePath: filepath,
      });
    } catch (error) {
      if (
        error instanceof FileStorageException &&
        (error.code === FileStorageExceptionCode.FILE_NOT_FOUND ||
          error.code === FileStorageExceptionCode.ACCESS_DENIED)
      ) {
        throw new FileException(
          'File not found',
          FileExceptionCode.FILE_NOT_FOUND,
        );
      }

      this.logger.error('readServerFile failed unexpectedly', { error });

      throw new FileException(
        'Error retrieving file',
        FileExceptionCode.INTERNAL_SERVER_ERROR,
      );
    }

    setFileResponseHeaders(res, fileResponse.mimeType);
    res.setHeader('Cache-Control', PUBLIC_ASSET_CACHE_CONTROL);

    try {
      await pipeline(fileResponse.stream, res);
    } catch (error) {
      this.logger.error(
        'Application registration file stream failed mid-transfer',
        { error },
      );

      if (!res.headersSent) {
        throw new FileException(
          'Error streaming file from storage',
          FileExceptionCode.INTERNAL_SERVER_ERROR,
        );
      }

      res.destroy();
    }
  }

  @Get('public-assets/:workspaceId/:applicationId/*path')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async getPublicAssets(
    @Res() res: Response,
    @Req() req: Request,
    @Param('workspaceId') workspaceId: string,
    @Param('applicationId')
    applicationId: string,
  ) {
    const filepath = join(...req.params.path);

    const filePathValidationResult = validateFilePath({
      resourcePath: filepath,
      fileFolder: FileFolder.PublicAsset,
    });

    if (!filePathValidationResult.isValid) {
      throw new FileException(
        'File not found',
        FileExceptionCode.FILE_NOT_FOUND,
      );
    }

    const fileResponse = await this.fileService
      .getFilePresignedUrlOrStreamByPath({
        workspaceId,
        applicationId,
        fileFolder: FileFolder.PublicAsset,
        filepath,
      })
      .catch((error) => {
        this.logger.error(
          'getFilePresignedUrlOrStreamByPath failed unexpectedly',
          {
            error,
          },
        );

        throw new FileException(
          'Error retrieving file',
          FileExceptionCode.INTERNAL_SERVER_ERROR,
        );
      });

    if (fileResponse === null) {
      throw new FileException(
        'File not found',
        FileExceptionCode.FILE_NOT_FOUND,
      );
    }

    if (fileResponse.type === 'redirect') {
      return res.redirect(fileResponse.presignedUrl);
    }

    setFileResponseHeaders(res, fileResponse.mimeType, FileFolder.PublicAsset);

    try {
      await pipeline(fileResponse.stream, res);
    } catch (error) {
      this.logger.error('Public asset stream failed mid-transfer', { error });

      if (!res.headersSent) {
        throw new FileException(
          'Error streaming file from storage',
          FileExceptionCode.INTERNAL_SERVER_ERROR,
        );
      }

      res.destroy();
    }
  }

  // Legacy imported attachments still store only `fullPath` values such as
  // `attachment/<uuid>.pdf`. Serve those directly from workspace storage until
  // they are backfilled to FILES-field records.
  @Get('files/*path')
  @UseGuards(NoPermissionGuard)
  async getLegacyWorkspaceFile(
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const filepath = join(...req.params.path);
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (
      token.length === 0 ||
      filepath.length === 0 ||
      filepath.includes('..') ||
      filepath.startsWith('/')
    ) {
      throw new FileException(
        'Authentication is required',
        FileExceptionCode.UNAUTHENTICATED,
      );
    }

    let workspaceId: string | undefined;

    try {
      const payload = await this.jwtWrapperService.verifyJwtToken(token);

      workspaceId =
        typeof payload.workspaceId === 'string' ? payload.workspaceId : undefined;
    } catch {
      workspaceId = undefined;
    }

    if (workspaceId === undefined) {
      throw new FileException(
        'Authentication is required',
        FileExceptionCode.UNAUTHENTICATED,
      );
    }

    const onStorageFilePath = join(`workspace-${workspaceId}`, filepath);
    const driver = this.fileStorageDriverFactory.getCurrentDriver();
    const mimeType = mimeLookup(filepath) || 'application/octet-stream';

    let stream: Readable;

    try {
      stream = await driver.readFile({
        filePath: onStorageFilePath,
      });
    } catch (error) {
      if (
        error instanceof FileStorageException &&
        (error.code === FileStorageExceptionCode.FILE_NOT_FOUND ||
          error.code === FileStorageExceptionCode.ACCESS_DENIED)
      ) {
        throw new FileException(
          'File not found',
          FileExceptionCode.FILE_NOT_FOUND,
        );
      }

      this.logger.error('Legacy workspace file read failed unexpectedly', {
        error,
        filepath,
        workspaceId,
      });

      throw new FileException(
        'Error retrieving file',
        FileExceptionCode.INTERNAL_SERVER_ERROR,
      );
    }

    setFileResponseHeaders(res, mimeType);

    try {
      await pipeline(stream, res);
    } catch (error) {
      this.logger.error('Legacy workspace file stream failed mid-transfer', {
        error,
        filepath,
        workspaceId,
      });

      if (!res.headersSent) {
        throw new FileException(
          'Error streaming file from storage',
          FileExceptionCode.INTERNAL_SERVER_ERROR,
        );
      }

      res.destroy();
    }
  }

  @Get('file/:fileFolder/:id')
  @UseGuards(FileByIdGuard, NoPermissionGuard)
  async getFileById(
    @Res() res: Response,
    @Req() req: Request,
    @Param('fileFolder') fileFolder: SupportedFileFolder,
    @Param('id') fileId: string,
  ) {
    // oxlint-disable-next-line typescript/no-explicit-any
    const workspaceId = (req as any)?.workspaceId;

    const fileResponse = await this.fileService
      .getFilePresignedUrlOrStreamById({
        fileId,
        workspaceId,
        fileFolder,
      })
      .catch((error) => {
        this.logger.error(
          'getFilePresignedUrlOrStreamById failed unexpectedly',
          {
            error,
          },
        );

        throw new FileException(
          'Error retrieving file',
          FileExceptionCode.INTERNAL_SERVER_ERROR,
        );
      });

    if (fileResponse === null) {
      throw new FileException(
        'File not found',
        FileExceptionCode.FILE_NOT_FOUND,
      );
    }

    if (fileResponse.type === 'redirect') {
      return res.redirect(fileResponse.presignedUrl);
    }

    setFileResponseHeaders(res, fileResponse.mimeType, fileFolder);

    try {
      await pipeline(fileResponse.stream, res);
    } catch (error) {
      this.logger.error('File-by-id stream failed mid-transfer', { error });

      if (!res.headersSent) {
        throw new FileException(
          'Error streaming file from storage',
          FileExceptionCode.INTERNAL_SERVER_ERROR,
        );
      }

      res.destroy();
    }
  }
}
