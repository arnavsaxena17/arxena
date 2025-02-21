import { WorkspaceQueryService } from "./workspace-modifications.service";

export class BaseService {
    constructor(protected readonly workspaceQueryService: WorkspaceQueryService) {}
  }
  