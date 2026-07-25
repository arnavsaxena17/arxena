import { gql } from '@apollo/client';

export const WORKSPACE_MCP_SERVERS = gql`
  query WorkspaceMcpServers {
    workspaceMcpServers {
      id
      label
      slug
      transport
      url
      authHeaderName
      enabled
      toolMode
      toolAllowlist
      catalogHash
      lastSyncAt
      lastSyncError
      timeoutMs
      createdAt
      updatedAt
      hasAuthToken
    }
  }
`;

export const CREATE_WORKSPACE_MCP_SERVER = gql`
  mutation CreateWorkspaceMcpServer($input: CreateWorkspaceMcpServerInput!) {
    createWorkspaceMcpServer(input: $input) {
      id
      label
      slug
      url
      enabled
      lastSyncAt
      lastSyncError
      hasAuthToken
    }
  }
`;

export const UPDATE_WORKSPACE_MCP_SERVER = gql`
  mutation UpdateWorkspaceMcpServer($input: UpdateWorkspaceMcpServerInput!) {
    updateWorkspaceMcpServer(input: $input) {
      id
      label
      slug
      url
      enabled
      lastSyncAt
      lastSyncError
      hasAuthToken
    }
  }
`;

export const DELETE_WORKSPACE_MCP_SERVER = gql`
  mutation DeleteWorkspaceMcpServer($id: UUID!) {
    deleteWorkspaceMcpServer(id: $id)
  }
`;

export const SYNC_WORKSPACE_MCP_SERVER_TOOLS = gql`
  mutation SyncWorkspaceMcpServerTools($id: UUID!) {
    syncWorkspaceMcpServerTools(id: $id) {
      id
      lastSyncAt
      lastSyncError
      catalogHash
    }
  }
`;
