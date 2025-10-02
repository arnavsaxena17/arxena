import type {
  LinkedinCheckpointData,
  LinkedinCookieAuth,
  LinkedinCredentials,
  LinkedinProfileData,
  LinkedinSignupResponse,
  UnipileLinkedinAccount,
} from 'twenty-shared';

export class LinkedinBackendService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else {
      // Get backend URL from environment or use default
      let serverBaseUrl = process.env.REACT_APP_SERVER_BASE_URL || 'http://localhost:3000';
      
      // Handle cross-subdomain requests in production
      if (typeof window !== 'undefined' && window.location.hostname.includes('arxena.com')) {
        // If we're on arxena.arxena.com, use app.arxena.com for the backend
        if (window.location.hostname === 'arxena.arxena.com') {
          serverBaseUrl = 'https://app.arxena.com';
        } else if (window.location.hostname === 'app.arxena.com') {
          serverBaseUrl = 'https://app.arxena.com';
        }
      }
      
      this.baseUrl = `${serverBaseUrl}/linkedin-unipile`;
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
    accessToken?: string,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add JWT token if provided
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const config: RequestInit = {
      method,
      headers,
      credentials: 'include', // Include cookies for session
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Backend API request failed:', error);
      throw error;
    }
  }

  /**
   * Connect LinkedIn account with username/password
   */
  async connectWithCredentials(credentials: LinkedinCredentials, accessToken?: string): Promise<LinkedinSignupResponse> {
    try {
      const response = await this.makeRequest<any>('/connect/credentials', 'POST', credentials, accessToken);

      return {
        success: response.success || true,
        data: response.data,
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
  async connectWithCookie(cookieAuth: LinkedinCookieAuth, accessToken?: string): Promise<LinkedinSignupResponse> {
    try {
      const response = await this.makeRequest<any>('/connect/cookie', 'POST', cookieAuth, accessToken);

      return {
        success: response.success || true,
        data: response.data,
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
    type?: 'create' | 'reconnect';
    providers?: string[] | '*';
    expiresOn?: string;
    success_redirect_url?: string;
    failure_redirect_url?: string;
    notify_url?: string;
    name?: string;
    reconnect_account?: string;
  }, accessToken?: string): Promise<{ 
    hosted_link: string; 
    expires_on: string; 
    name: string; 
    success: boolean; 
  }> {
    const response = await this.makeRequest<{ 
      hosted_link: string; 
      expires_on: string; 
      name: string; 
      success: boolean; 
    }>('/hosted-auth', 'POST', options, accessToken);
    return response;
  }

  /**
   * Solve 2FA/OTP checkpoint
   */
  async solveCheckpoint(checkpointData: LinkedinCheckpointData, accessToken?: string): Promise<LinkedinSignupResponse> {
    try {
      const response = await this.makeRequest<any>('/checkpoint', 'POST', checkpointData, accessToken);

      return {
        success: response.success || true,
        data: response.data,
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
  async getAccount(accountId: string, accessToken?: string): Promise<UnipileLinkedinAccount> {
    const response = await this.makeRequest<{ account: UnipileLinkedinAccount }>(`/accounts/${accountId}`, 'GET', undefined, accessToken);
    return response.account;
  }

  /**
   * Get all LinkedIn accounts
   */
  async getAllAccounts(accessToken?: string): Promise<UnipileLinkedinAccount[]> {
    const response = await this.makeRequest<{ accounts: UnipileLinkedinAccount[] }>('/accounts', 'GET', undefined, accessToken);
    console.log('getAllAccounts response', response);
    return response.accounts || [];
  }

  /**
   * Get own LinkedIn profile
   */
  async getOwnProfile(accountId: string, accessToken?: string): Promise<LinkedinProfileData> {
    const response = await this.makeRequest<{ profile: LinkedinProfileData }>(`/profile/me/${accountId}`, 'GET', undefined, accessToken);
    return response.profile;
  }

  /**
   * Resync LinkedIn account
   */
  async resyncAccount(accountId: string, accessToken?: string): Promise<{ status: string }> {
    const response = await this.makeRequest<{ status: string }>(`/accounts/${accountId}/resync`, 'POST', undefined, accessToken);
    return { status: response.status };
  }

  /**
   * Disconnect LinkedIn account
   */
  async disconnectAccount(accountId: string, accessToken?: string): Promise<{ success: boolean }> {
    try {
      await this.makeRequest(`/accounts/${accountId}`, 'DELETE', undefined, accessToken);
      return { success: true };
    } catch (error) {
      console.error('Failed to disconnect LinkedIn account:', error);
      return { success: false };
    }
  }

  /**
   * Get LinkedIn user profile
   */
  async getProfile(profileRequest: {
    account_id: string;
    identifier: string;
    linkedin_sections?: string[];
    notify?: boolean;
  }, accessToken?: string): Promise<LinkedinProfileData> {
    const response = await this.makeRequest<{ profile: LinkedinProfileData }>('/profile', 'POST', profileRequest, accessToken);
    return response.profile;
  }

  /**
   * Send LinkedIn message
   */
  async sendMessage(messageData: {
    account_id: string;
    attendees_ids: string[];
    text: string;
    options?: {
      linkedin?: {
        api?: 'classic' | 'recruiter' | 'sales_navigator';
        inmail?: boolean;
      };
    };
  }, accessToken?: string): Promise<any> {
    const response = await this.makeRequest<{ chat: any }>('/message/send', 'POST', messageData, accessToken);
    return response.chat;
  }

  /**
   * Check service health
   */
  async getHealth(accessToken?: string): Promise<{
    service: string;
    status: string;
    timestamp: string;
    unipile_configured: boolean;
    unipile_url: string;
  }> {
    return this.makeRequest<any>('/health', 'GET', undefined, accessToken);
  }
}

// Singleton instance for frontend use
let linkedinBackendService: LinkedinBackendService | null = null;

export const getLinkedinService = (baseUrl?: string): LinkedinBackendService => {
  if (!linkedinBackendService) {
    linkedinBackendService = new LinkedinBackendService(baseUrl);
  }
  
  return linkedinBackendService;
};

export const initializeLinkedinService = (baseUrl?: string): void => {
  linkedinBackendService = new LinkedinBackendService(baseUrl);
};
