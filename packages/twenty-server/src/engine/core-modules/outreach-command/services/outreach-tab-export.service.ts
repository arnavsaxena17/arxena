import { Injectable } from '@nestjs/common';

import { FileFolder } from 'twenty-shared/types';
import { v4 } from 'uuid';

import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { FileStorageService } from 'src/engine/core-modules/file-storage/services/file-storage.service';
import { FileUrlService } from 'src/engine/core-modules/file/file-url/file-url.service';
import {
  type OutreachEntity,
  type OutreachRow,
} from 'src/engine/core-modules/outreach-command/rows/outreach-rows.types';
import { buildOutreachRowsCsv } from 'src/engine/core-modules/outreach-command/rows/utils/outreach-rows-csv.util';

export type OutreachTabExportResult = {
  fileId: string;
  filename: string;
  url: string;
  count: number;
};

// Export the project's Companies or People tab as a CSV. The tab is the only
// result store now, so the file is built from its rows, not from a list.
@Injectable()
export class OutreachTabExportService {
  constructor(
    private readonly applicationService: ApplicationService,
    private readonly fileStorageService: FileStorageService,
    private readonly fileUrlService: FileUrlService,
  ) {}

  async export({
    workspaceId,
    entity,
    rows,
  }: {
    workspaceId: string;
    entity: OutreachEntity;
    rows: OutreachRow[];
  }): Promise<OutreachTabExportResult> {
    const { workspaceCustomFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );
    const fileId = v4();
    const filename = `${entity === 'company' ? 'companies' : 'people'}-${fileId.slice(0, 8)}.csv`;
    const savedFile = await this.fileStorageService.writeFile({
      sourceFile: Buffer.from(buildOutreachRowsCsv(entity, rows), 'utf-8'),
      fileFolder: FileFolder.AgentChat,
      applicationUniversalIdentifier:
        workspaceCustomFlatApplication.universalIdentifier,
      workspaceId,
      resourcePath: `outreach-tab-exports/${workspaceId}/${fileId}-${filename}`,
      fileId,
      settings: { isTemporaryFile: false, toDelete: false },
    });
    const url = await this.fileUrlService.signFileByIdUrl({
      fileId: savedFile.id,
      workspaceId,
      fileFolder: FileFolder.AgentChat,
    });

    return { fileId: savedFile.id, filename, url, count: rows.length };
  }
}
