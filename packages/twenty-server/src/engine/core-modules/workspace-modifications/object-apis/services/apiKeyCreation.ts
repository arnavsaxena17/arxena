import axios from 'axios';

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

type ApiKeyRole = {
  id: string;
  label: string;
  canBeAssignedToApiKeys?: boolean;
};

type CreatedApiKey = {
  id: string;
  name: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  revokedAt: null | string;
};

export class ApiKeyService {
  private readonly metadataUrl: string;

  constructor(
    metadataUrl: string = process.env.GRAPHQL_URL_METADATA ||
      'http://localhost:3000/metadata',
  ) {
    this.metadataUrl = metadataUrl;
  }

  private async graphqlRequest<T>(
    query: string,
    variables: Record<string, unknown>,
    authToken: string,
    origin: string,
  ): Promise<T> {
    const response = await axios.request<GraphQLResponse<T>>({
      method: 'post',
      url: this.metadataUrl,
      headers: {
        authorization: `Bearer ${authToken}`,
        'content-type': 'application/json',
        Origin: origin,
      },
      data: {
        query,
        variables,
      },
    });

    const graphqlErrors = response.data.errors;
    if (Array.isArray(graphqlErrors) && graphqlErrors.length > 0) {
      const message = graphqlErrors
        .map((error) => error.message)
        .filter((part): part is string => Boolean(part))
        .join('; ');
      throw new Error(message || 'Metadata GraphQL request failed');
    }

    if (!response.data.data) {
      throw new Error('Metadata GraphQL request returned no data');
    }

    return response.data.data;
  }

  async createApiKey(
    authToken: string,
    origin: string,
    name: string = 'test_api_key',
  ): Promise<string> {
    try {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 100);
      const expiresAtIso = expiresAt.toISOString();

      const roleId = await this.resolveAssignableRoleId(authToken, origin);

      const created = await this.graphqlRequest<{ createApiKey: CreatedApiKey }>(
        `
        mutation CreateOneApiKey($input: CreateApiKeyInput!) {
          createApiKey(input: $input) {
            id
            name
            expiresAt
            updatedAt
            revokedAt
            createdAt
          }
        }
      `,
        {
          input: {
            name,
            expiresAt: expiresAtIso,
            roleId,
          },
        },
        authToken,
        origin,
      );

      const apiKeyId = created.createApiKey.id;

      const tokenResponse = await this.graphqlRequest<{
        generateApiKeyToken: { token: string };
      }>(
        `
        mutation GenerateApiKeyToken($apiKeyId: UUID!, $expiresAt: String!) {
          generateApiKeyToken(apiKeyId: $apiKeyId, expiresAt: $expiresAt) {
            token
          }
        }
      `,
        {
          apiKeyId,
          expiresAt: expiresAtIso,
        },
        authToken,
        origin,
      );

      console.log('API Key created:', created.createApiKey);

      const apiToken = tokenResponse.generateApiKeyToken.token;
      console.log('API Key token:', apiToken);

      await this.updateTwentyApiKeys(apiToken, authToken);

      return apiToken;
    } catch (error) {
      console.error('Error in API key creation:', error);
      throw new Error('Failed to create API key');
    }
  }

  private async resolveAssignableRoleId(
    authToken: string,
    origin: string,
  ): Promise<string> {
    const rolesResponse = await this.graphqlRequest<{
      getApiKeyRoles: ApiKeyRole[];
    }>(
      `
        query GetApiKeyRoles {
          getApiKeyRoles {
            id
            label
            canBeAssignedToApiKeys
          }
        }
      `,
      {},
      authToken,
      origin,
    );

    const roles = (rolesResponse.getApiKeyRoles ?? []).filter(
      (role) => role.canBeAssignedToApiKeys !== false,
    );
    const adminRole = roles.find((role) => role.label === 'Admin');
    const roleId = adminRole?.id ?? roles[0]?.id;

    if (!roleId) {
      throw new Error('No API-key-assignable role found for workspace');
    }

    return roleId;
  }

  private async updateTwentyApiKeys(
    twentyApiKey: string,
    authToken: string,
  ): Promise<void> {
    try {
      let arxenaSiteBaseUrl: string = '';
      console.log('process.env.ENV_NODE', process.env.ENV_NODE);
      if (process.env.ENV_NODE === 'development') {
        arxenaSiteBaseUrl =
          process.env.REACT_APP_ARXENA_SITE_BASE_URL ||
          'http://localhost:5050';
      } else {
        arxenaSiteBaseUrl =
          process.env.REACT_APP_ARXENA_SITE_BASE_URL || 'https://arxena.com';
      }

      console.log('Updating Twenty API keys', arxenaSiteBaseUrl);
      const response = await axios.post(
        arxenaSiteBaseUrl + '/update-twenty-api-keys',
        { twenty_api_key: twentyApiKey },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      console.log('Response from update twenty api keys', response.data);
    } catch (error) {
      console.error('Error updating Twenty API keys:', error);
      throw new Error('Failed to update Twenty API keys');
    }
  }
}
