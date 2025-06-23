import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { graphql } from 'graphql';
import { WorkspaceSchemaFactory } from 'src/engine/api/graphql/workspace-schema.factory';
import { AuthContext } from 'src/engine/core-modules/auth/types/auth-context.type';
import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { WorkspaceActivationStatus } from 'twenty-shared';

export async function axiosRequest(data: string, apiToken: string) {
  const response = await axios.request({
    method: 'post',
    url: process.env.GRAPHQL_URL,
    headers: {
      authorization: 'Bearer ' + apiToken,
      'content-type': 'application/json',
    },
    timeout: 10000,  // Increase timeout to 60 seconds (or more if needed)
    data: data,
  });
  
  if (response.data.errors) {
    console.log('Error axiosRequest', response.data, "for grapqhl request of ::", data);
  }
  
  return response;
}

export async function axiosRequestForMetadata(data: string, apiToken: string) {
  const response = await axios.request({
    method: 'post',
    url: process.env.GRAPHQL_URL_METADATA,
    headers: {
      authorization: 'Bearer ' + apiToken,
      'content-type': 'application/json',
    },
    timeout: 10000,
    data: data,
  });
  if (response.data.errors) {
    console.log('Error axiosRequestForMetadata', response.data, "for grapqhl request of ::", data);
  }
  return response;
}

@Injectable()
export class GraphQLExecutionService {
  constructor(
    private readonly workspaceSchemaFactory: WorkspaceSchemaFactory,
    private readonly jwtWrapperService: JwtWrapperService,
  ) {}

  private async getWorkspaceIdFromToken(apiToken: string): Promise<string> {
    const payload = this.jwtWrapperService.decode(apiToken, { json: true });
    
    if (!payload?.workspaceId) {
      throw new Error('No workspace ID found in token');
    }

    return payload.workspaceId;
  }

  async executeGraphQL(query: string, variables: any, apiToken: string) {
    try {
      // Parse the JWT token to get workspace and user info
      const payload = this.jwtWrapperService.decode(apiToken, { json: true });
      console.log('payload in executeGraphQL', payload);
      if (!payload?.workspaceId) {
        throw new Error('No workspace ID found in token');
      }

      // Create the auth context from the token payload
      const authContext: AuthContext = {
        user: payload.user,
        workspace: {
          id: payload.workspaceId,
          displayName: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          allowImpersonation: false,
          isPublicInviteLinkEnabled: true,
          activationStatus: WorkspaceActivationStatus.ACTIVE,
          metadataVersion: 1,
          databaseUrl: '',
          databaseSchema: '',
          subdomain: '',
          isGoogleAuthEnabled: true,
          isPasswordAuthEnabled: true,
          isMicrosoftAuthEnabled: true,
          isCustomDomainEnabled: false,
        } as Workspace,
        workspaceMemberId: payload.workspaceMemberId,
        userWorkspaceId: payload.userWorkspaceId,
      };
      console.log('authContext in executeGraphQL', authContext);
      // Get the schema for this workspace
      const schema = await this.workspaceSchemaFactory.createGraphQLSchema(authContext);
      console.log('schema in executeGraphQL', schema);
      // Execute the query directly
      const result = await graphql({
        schema,
        source: query,
        variableValues: variables,
        contextValue: {
          req: {
            user: payload.user,
            workspace: {
              id: payload.workspaceId,
            },
          },
        },
      });
      console.log('result in executeGraphQL', result);
      return {
        data: result,
      };
    } catch (error) {
      console.error('Error executing GraphQL query:', error);
      throw error;
    }
  }
}

