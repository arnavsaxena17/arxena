import type {
    LinkedinCheckpointData,
    LinkedinCookieAuth,
    LinkedinCredentials,
    LinkedinProfileData,
    LinkedinSignupResponse,
    UnipileLinkedinAccount,
} from 'twenty-shared';

export class LinkedinUnipileService {
  private baseUrl: string;
  private accessToken: string;

  constructor(baseUrl: string, accessToken: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.accessToken = accessToken;
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(body);
    }

    try {
      console.log('url being made to ', url);
      console.log('config being made to ', config);
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Unipile API request failed:', error);
      throw error;
    }
  }

  /**
   * Connect LinkedIn account with username/password
   */
  async connectWithCredentials(credentials: LinkedinCredentials): Promise<LinkedinSignupResponse> {
    try {
      const response = await this.makeRequest<any>('/api/v1/accounts', 'POST', {
        provider: 'LINKEDIN',
        username: credentials.username,
        password: credentials.password,
      });

      return {
        success: true,
        data: {
          account_id: response.id || response.account_id,
          provider: 'LINKEDIN',
          status: response.status || 'connected',
          profile: response.profile_data,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Connect LinkedIn account with cookie/user-agent
   */
  async connectWithCookie(cookieAuth: LinkedinCookieAuth): Promise<LinkedinSignupResponse> {
    try {
      const response = await this.makeRequest<any>('/api/v1/accounts', 'POST', {
        provider: 'LINKEDIN',
        access_token: cookieAuth.access_token,
        ...(cookieAuth.premium_token && { premium_token: cookieAuth.premium_token }),
        ...(cookieAuth.user_agent && { user_agent: cookieAuth.user_agent }),
        ...(cookieAuth.ip && { ip: cookieAuth.ip }),
        ...(cookieAuth.country && { country: cookieAuth.country }),
      });

      return {
        success: true,
        data: {
          account_id: response.id || response.account_id,
          provider: 'LINKEDIN',
          status: response.status || 'connected',
          profile: response.profile_data,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Create hosted authentication link
   */
  async createHostedAuthLink(options: {
    expiresOn?: string;
    api_url?: string;
    success_redirect_url?: string;
    failure_redirect_url?: string;
    notify_url?: string;
  }): Promise<{ hosted_link: string }> {
    return this.makeRequest<{ hosted_link: string }>('/api/v1/accounts/hosted-auth', 'POST', {
      type: 'create',
      providers: 'linkedin',
      expiresOn: options.expiresOn || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      ...options,
    });
  }

  /**
   * Solve 2FA/OTP checkpoint
   */
  async solveCheckpoint(checkpointData: LinkedinCheckpointData): Promise<LinkedinSignupResponse> {
    try {
      const response = await this.makeRequest<any>('/api/v1/accounts/checkpoint', 'POST', checkpointData);

      return {
        success: true,
        data: {
          account_id: response.account_id,
          provider: 'LINKEDIN',
          status: response.status || 'connected',
          profile: response.profile_data,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get LinkedIn account details
   */
  async getAccount(accountId: string): Promise<UnipileLinkedinAccount> {
    return this.makeRequest<UnipileLinkedinAccount>(`/api/v1/accounts/${accountId}`);
  }

  /**
   * Get all LinkedIn accounts
   */
  async getAllAccounts(): Promise<UnipileLinkedinAccount[]> {
    const response = await this.makeRequest<{ items: any[] }>('/api/v1/accounts?provider=linkedin');
    
    // Transform the response to match our expected format
    return (response.items || []).map((item: any) => ({
      id: item.id,
      username: item.name || 'Unknown',
      name: item.name || 'Unknown', 
      type: item.type,
      status: this.mapAccountStatus(item),
      created_at: item.created_at,
      provider: 'LINKEDIN',
      connection_params: item.connection_params,
      sources: item.sources || [],
      groups: item.groups || [],
    }));
  }

  private mapAccountStatus(account: any): 'connected' | 'disconnected' | 'pending' | 'checkpoint_required' {
    // Map Unipile account status to our status format
    const rawStatus =
      account?.connection_params?.status ??
      account?.status ??
      account?.connection_params?.im?.status ??
      account?.sources?.[0]?.status;

    if (typeof rawStatus === 'string') {
      const status = rawStatus.toLowerCase();

      if (['active', 'ok', 'connected', 'ready', 'synced'].includes(status)) {
        return 'connected';
      }
      if (['credentials', 'failed', 'error', 'disconnected', 'revoked'].includes(status)) {
        return 'disconnected';
      }
      if (status === 'checkpoint_required') {
        return 'checkpoint_required';
      }
      if (status === 'pending' || status === 'syncing') {
        return 'pending';
      }
      // Fallback for unknown statuses
      return 'disconnected';
    }
    
    // Default to connected if we have the account
    return account?.id ? 'connected' : 'disconnected';
  }

  /**
   * Get own LinkedIn profile
   */
  async getOwnProfile(accountId: string): Promise<LinkedinProfileData> {
    return this.makeRequest<LinkedinProfileData>(`/api/v1/users/me?account_id=${accountId}`);
  }

  /**
   * Resync LinkedIn account
   */
  async resyncAccount(accountId: string): Promise<{ status: string }> {
    return this.makeRequest<{ status: string }>(`/api/v1/accounts/${accountId}/resync`, 'POST');
  }

  /**
   * Disconnect LinkedIn account
   */
  async disconnectAccount(accountId: string): Promise<{ success: boolean }> {
    try {
      await this.makeRequest(`/api/v1/accounts/${accountId}`, 'DELETE');
      return { success: true };
    } catch (error) {
      console.error('Failed to disconnect LinkedIn account:', error);
      return { success: false };
    }
  }
}

// Singleton instance for server-side use
let linkedinService: LinkedinUnipileService | null = null;

export const getLinkedinUnipileService = (baseUrl?: string, accessToken?: string): LinkedinUnipileService => {
  if (!linkedinService && baseUrl && accessToken) {
    linkedinService = new LinkedinUnipileService(baseUrl, accessToken);
  }
  
  if (!linkedinService) {
    throw new Error('LinkedIn Unipile service not initialized. Please provide baseUrl and accessToken.');
  }
  
  return linkedinService;
};

export const initializeLinkedinUnipileService = (baseUrl: string, accessToken: string): void => {
  linkedinService = new LinkedinUnipileService(baseUrl, accessToken);
};

