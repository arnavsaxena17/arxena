import { Injectable } from '@nestjs/common';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';

@Injectable()
export class CronServiceLocator {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {}

  getWorkspaceQueryService(): WorkspaceQueryService {
    return this.workspaceQueryService;
  }
} 