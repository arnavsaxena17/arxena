import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import {
  extractWorkspaceMemberNode,
  findWorkspaceMembersForArx,
  Project,
  workspaceMemberFilterById,
  type WorkspaceMemberArxGraphqlNode,
} from 'twenty-shared';

export type WorkspaceCompanyProfile = {
  companyName: string | null;
  summary: string | null;
};

type CurrentUserWithWorkspaceCompany = {
  currentWorkspace?: {
    companyName?: string | null;
    summary?: string | null;
  } | null;
} | null;

export class WorkspaceMemberArxService {
  constructor(private readonly staticGraphQLService: StaticGraphQLService) {}

  async getByProject(
    candidateJob: Project,
    apiToken: string,
  ): Promise<WorkspaceMemberArxGraphqlNode | null> {
    const workspaceMemberId = candidateJob?.recruiterId;

    if (!workspaceMemberId) {
      console.warn(
        '[WorkspaceMemberArxService] Project has no recruiterId, cannot resolve workspace member',
        candidateJob?.id,
      );

      return null;
    }

    return this.getById(workspaceMemberId, apiToken);
  }

  async getById(
    workspaceMemberId: string,
    apiToken: string,
  ): Promise<WorkspaceMemberArxGraphqlNode | null> {
    const workspaceMembersResponse =
      await this.staticGraphQLService.executeGraphQL(
        findWorkspaceMembersForArx,
        workspaceMemberFilterById(workspaceMemberId),
        apiToken,
      );

    return extractWorkspaceMemberNode(workspaceMembersResponse);
  }

  async getCurrentUser(apiToken: string, _origin?: string) {
    return this.staticGraphQLService.getCurrentUser(apiToken);
  }

  async getFromCurrentUser(
    apiToken: string,
    origin: string,
  ): Promise<WorkspaceMemberArxGraphqlNode | null> {
    const currentUser = await this.getCurrentUser(apiToken, origin);
    const workspaceMemberId = (
      currentUser as { workspaceMember?: { id?: string } } | null
    )?.workspaceMember?.id;

    if (!workspaceMemberId) {
      return null;
    }

    return this.getById(workspaceMemberId, apiToken);
  }

  async getWorkspaceCompanyProfile(
    apiToken: string,
  ): Promise<WorkspaceCompanyProfile> {
    const currentUser = (await this.getCurrentUser(
      apiToken,
    )) as CurrentUserWithWorkspaceCompany;

    const companyName = currentUser?.currentWorkspace?.companyName?.trim();
    const summary = currentUser?.currentWorkspace?.summary?.trim();

    return {
      companyName: companyName || null,
      summary: summary || null,
    };
  }
}
