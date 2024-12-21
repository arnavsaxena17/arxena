import axios from 'axios';

interface ApiKeyResponse {
  data: {
    createApiKey: {
      id: string;
      name: string;
      expiresAt: string;
      createdAt: string;
      updatedAt: string;
      revokedAt: null | string;
    }
  }
}

interface ApiKeyTokenResponse {
  data: {
    generateApiKeyToken: {
      token: string;
    }
  }
}

export class ApiKeyService {
  private readonly baseUrl: string;
  
  constructor(baseUrl: string = process.env.GRAPHQL_URL || 'http://localhost:3000/graphql') {
    this.baseUrl = baseUrl;
  }

  private async graphqlRequest(query: string, variables: any, authToken: string) {
    return axios.request({
      method: 'post',
      url: this.baseUrl,
      headers: {
        authorization: `Bearer ${authToken}`,
        'content-type': 'application/json',
      },
      data: {
        query,
        variables,
      },
    });
  }

  async createApiKey(authToken: string, name: string = 'test_api_key'): Promise<string> {
    try {
      // Calculate expiry date 100 years in the future
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 100);
      
    const apiKeyId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create API Key
      const createKeyMutation = `
        mutation CreateOneApiKey($input: ApiKeyCreateInput!) {
          createApiKey(data: $input) {
            id
            name
            expiresAt
            updatedAt
            revokedAt
            createdAt
          }
        }
      `;

      const createKeyVariables = {
        input: {
          name,
          expiresAt: expiresAt.toISOString(),
          id: apiKeyId,
        },
      };

      const createKeyResponse = await this.graphqlRequest(
        createKeyMutation,
        createKeyVariables,
        authToken
      );

      // Generate API Key Token
      const generateTokenMutation = `
        mutation GenerateApiKeyToken($apiKeyId: String!, $expiresAt: String!) {
          generateApiKeyToken(apiKeyId: $apiKeyId, expiresAt: $expiresAt) {
            token
          }
        }
      `;

      const generateTokenVariables = {
        apiKeyId,
        expiresAt: expiresAt.toISOString(),
      };

      const tokenResponse = await this.graphqlRequest(
        generateTokenMutation,
        generateTokenVariables,
        authToken
      );

      const apiToken = tokenResponse.data.data.generateApiKeyToken.token;

      // Update Twenty API Keys
      await this.updateTwentyApiKeys(apiToken, authToken);

      return apiToken;

    } catch (error) {
      console.error('Error in API key creation:', error);
      throw new Error('Failed to create API key');
    }
  }

  private async updateTwentyApiKeys(twentyApiKey: string, authToken: string): Promise<void> {
    try {
      await axios.post(
        process.env.ARXENA_SITE_BASE_URL+'/update-twenty-api-keys',
        { twenty_api_key: twentyApiKey },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      console.error('Error updating Twenty API keys:', error);
      throw new Error('Failed to update Twenty API keys');
    }
  }
}