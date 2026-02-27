import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import type {
  UnipileWhatsappAccount,
  WhatsappQrCodeResponse,
} from 'twenty-shared';

export class WhatsappUnipileBackendService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else {
      const serverBaseUrl = process.env.REACT_APP_SERVER_BASE_URL || 'http://localhost:3000';
      this.baseUrl = `${serverBaseUrl}/whatsapp-unipile`;
      console.log('WhatsApp Unipile Backend Service initialized with baseUrl:', this.baseUrl);
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
    accessToken?: string,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    console.log('WhatsApp Unipile Backend Service making request:', {
      url,
      method,
      endpoint,
      baseUrl: this.baseUrl,
      hasAccessToken: !!accessToken,
    });
    
    const config: AxiosRequestConfig = {
      method: method.toLowerCase() as 'get' | 'post' | 'put' | 'delete',
      url,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: false,
    };

    if (accessToken) {
      config.headers!['Authorization'] = `Bearer ${accessToken}`;
    }

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
   * Request QR code for WhatsApp connection
   */
  async requestQrCode(accessToken?: string): Promise<WhatsappQrCodeResponse> {
    const response = await this.makeRequest<WhatsappQrCodeResponse>(
      '/qr-code',
      'POST',
      undefined,
      accessToken,
    );
    return response;
  }

  /**
   * Check account status (for polling)
   */
  async checkAccountStatus(accountId: string, accessToken?: string): Promise<{
    status: 'connected' | 'disconnected' | 'pending' | 'connecting';
    account_id: string;
  }> {
    const response = await this.makeRequest<{
      success: boolean;
      status: 'connected' | 'disconnected' | 'pending' | 'connecting';
      account_id: string;
    }>(`/accounts/${accountId}/status`, 'GET', undefined, accessToken);
    return {
      status: response.status,
      account_id: response.account_id,
    };
  }

  /**
   * Get all WhatsApp accounts
   */
  async getAllAccounts(accessToken?: string): Promise<UnipileWhatsappAccount[]> {
    const response = await this.makeRequest<{ accounts: UnipileWhatsappAccount[] }>(
      '/accounts',
      'POST',
      undefined,
      accessToken,
    );
    return response.accounts || [];
  }

  /**
   * Get WhatsApp account details
   */
  async getAccount(accountId: string, accessToken?: string): Promise<UnipileWhatsappAccount> {
    const response = await this.makeRequest<{ account: UnipileWhatsappAccount }>(
      `/accounts/${accountId}`,
      'POST',
      undefined,
      accessToken,
    );
    return response.account;
  }

  /**
   * Resync WhatsApp account
   */
  async resyncAccount(accountId: string, accessToken?: string): Promise<{ status: string }> {
    const response = await this.makeRequest<{ status: string }>(
      `/accounts/${accountId}/resync`,
      'POST',
      undefined,
      accessToken,
    );
    return { status: response.status };
  }

  /**
   * Update workspace member profile with WhatsApp Unipile account ID.
   * Call this when a new account is connected (e.g. after QR code scan).
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
      console.error('Failed to update member WhatsApp account:', error);
      return { success: false };
    }
  }

  /**
   * Disconnect WhatsApp account
   */
  async disconnectAccount(accountId: string, accessToken?: string): Promise<{ success: boolean }> {
    try {
      await this.makeRequest(`/accounts/${accountId}`, 'DELETE', undefined, accessToken);
      return { success: true };
    } catch (error) {
      console.error('Failed to disconnect WhatsApp account:', error);
      return { success: false };
    }
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
let whatsappUnipileBackendService: WhatsappUnipileBackendService | null = null;

export const getWhatsappUnipileService = (baseUrl?: string): WhatsappUnipileBackendService => {
  if (!whatsappUnipileBackendService || baseUrl) {
    whatsappUnipileBackendService = new WhatsappUnipileBackendService(baseUrl);
  }
  
  return whatsappUnipileBackendService;
};

export const initializeWhatsappUnipileService = (baseUrl?: string): void => {
  whatsappUnipileBackendService = new WhatsappUnipileBackendService(baseUrl);
};

