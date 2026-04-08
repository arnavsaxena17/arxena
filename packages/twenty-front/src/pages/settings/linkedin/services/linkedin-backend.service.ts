import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
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
      // Use the same approach as other working services
      const serverBaseUrl = process.env.REACT_APP_SERVER_BASE_URL || 'http://localhost:3000';
      this.baseUrl = `${serverBaseUrl}/linkedin-unipile`;
      console.log('LinkedIn Backend Service initialized with baseUrl:', this.baseUrl);
      console.log('REACT_APP_SERVER_BASE_URL:', process.env.REACT_APP_SERVER_BASE_URL);
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
    accessToken?: string,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    console.log('LinkedIn Backend Service making request:', {
      url,
      method,
      endpoint,
      baseUrl: this.baseUrl,
      hasAccessToken: !!accessToken,
      currentOrigin: typeof window !== 'undefined' ? window.location.origin : 'server-side'
    });
    
    const config: AxiosRequestConfig = {
      method: method.toLowerCase() as 'get' | 'post' | 'put' | 'delete',
      url,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: false, // Disable credentials to avoid CORS issues
    };

    // Add JWT token if provided
    if (accessToken) {
      config.headers!['Authorization'] = `Bearer ${accessToken}`;
    }

    // Add request body for POST/PUT requests
    if (body && (method === 'POST' || method === 'PUT')) {
      config.data = body;
    }

    try {
      const response: AxiosResponse<T> = await axios(config);
      return response.data;
    } catch (error) {
      console.error('Backend API request failed:', error);
      
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || 
                           `HTTP ${error.response?.status}: ${error.response?.statusText}` ||
                           error.message;
        throw new Error(errorMessage);
      }
      
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

    console.log("createHostedAuthLink got called");
    console.log("options:", options);
    console.log("accessToken:", accessToken);
    console.log("typeof options.success_redirect_url:", typeof options.success_redirect_url);
    console.log("options.success_redirect_url:", options.success_redirect_url);
    console.log("typeof options.failure_redirect_url:", typeof options.failure_redirect_url);
    console.log("options.failure_redirect_url:", options.failure_redirect_url);
    console.log("typeof options.notify_url:", typeof options.notify_url);
    console.log("options.notify_url:", options.notify_url);
    console.log("typeof options.name:", typeof options.name);
    console.log("options.name:", options.name);
    console.log("typeof options.reconnect_account:", typeof options.reconnect_account);
    console.log("options.reconnect_account:", options.reconnect_account);
    const response = await this.makeRequest<{ 
      hosted_link: string; 
      expires_on: string; 
      name: string; 
      success: boolean; 
    }>('/hosted-auth', 'POST', options, accessToken);

    if (response && typeof response.hosted_link === 'string') {
      response.hosted_link = response.hosted_link.replace('account.unipile.com', 'auth.arxena.com');
    }

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
    const response = await this.makeRequest<{ account: UnipileLinkedinAccount }>(`/accounts/${accountId}`, 'POST', undefined, accessToken);
    return response.account;
  }

  /**
   * Get all LinkedIn accounts
   */
  async getAllAccounts(accessToken?: string): Promise<UnipileLinkedinAccount[]> {
    const response = await this.makeRequest<{ accounts: UnipileLinkedinAccount[] }>('/accounts', 'POST', undefined, accessToken);
    return response.accounts || [];
  }

  /**
   * Get own LinkedIn profile
   */
  async getOwnProfile(accountId: string, accessToken?: string): Promise<LinkedinProfileData> {
    const response = await this.makeRequest<{ profile: LinkedinProfileData }>(`/profile/me/${accountId}`, 'POST', undefined, accessToken);
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
   * Update workspace member profile with LinkedIn Unipile account ID.
   * Call this when a new account is connected (e.g. after Hosted Auth redirect).
   */
  async updateMemberAccount(accountId: string, accessToken?: string): Promise<{ success: boolean }> {
    try {
      await this.makeRequest<{ success: boolean }>(
        '/accounts/update-member',
        'POST',
        { accountId },
        accessToken,
      );
      return { success: true };
    } catch (error) {
      console.error('Failed to update member LinkedIn account:', error);
      return { success: false };
    }
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
    return this.makeRequest<any>('/health', 'POST', undefined, accessToken);
  }
}

// Singleton instance for frontend use
let linkedinBackendService: LinkedinBackendService | null = null;

export const getLinkedinService = (baseUrl?: string): LinkedinBackendService => {
  if (!linkedinBackendService || baseUrl) {
    linkedinBackendService = new LinkedinBackendService(baseUrl);
  }
  
  return linkedinBackendService;
};

export const initializeLinkedinService = (baseUrl?: string): void => {
  linkedinBackendService = new LinkedinBackendService(baseUrl);
};
