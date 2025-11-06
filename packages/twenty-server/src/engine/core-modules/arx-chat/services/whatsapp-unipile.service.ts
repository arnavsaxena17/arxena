import { Logger } from '@nestjs/common';

export class WhatsappUnipileService {
  private baseUrl: string;
  private accessToken: string;
  private readonly logger = new Logger(WhatsappUnipileService.name);

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
      'X-API-KEY': this.accessToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const config: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(body);
    }

    try {
      this.logger.log(`Making Unipile request to: ${url}`);
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.logger.error(`Unipile API error: ${response.status} ${response.statusText}`, errorData);
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error('Unipile API request failed:', error);
      throw error;
    }
  }

  /**
   * Request QR code for WhatsApp connection
   */
  async requestQrCode(): Promise<{ qrCodeString: string; code: string }> {
    try {
      const response = await this.makeRequest<{ qr_code: string; code: string }>(
        '/api/v1/accounts/whatsapp',
        'POST',
      );

      return {
        qrCodeString: response.qr_code,
        code: response.code,
      };
    } catch (error) {
      this.logger.error('Failed to request WhatsApp QR code:', error);
      throw error;
    }
  }

  /**
   * Check account status (for polling)
   */
  async checkAccountStatus(accountId: string): Promise<{
    status: 'connected' | 'disconnected' | 'pending' | 'connecting';
    account_id: string;
  }> {
    try {
      const response = await this.makeRequest<{
        id: string;
        status: string;
        connection_params?: { status?: string };
      }>(`/api/v1/accounts/${accountId}`);

      const status = this.mapAccountStatus(response);
      return {
        status,
        account_id: response.id,
      };
    } catch (error) {
      this.logger.error(`Failed to check account status for ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Get all WhatsApp accounts
   */
  async getAllAccounts(): Promise<any[]> {
    try {
      const response = await this.makeRequest<{ items: any[] }>(
        '/api/v1/accounts?provider=whatsapp',
      );
      
      // Transform the response to match our expected format
      return (response.items || []).map((item: any) => ({
        id: item.id,
        username: item.name || item.phone_number || 'Unknown',
        name: item.name || 'Unknown',
        phone_number: item.phone_number,
        type: item.type,
        status: this.mapAccountStatus(item),
        created_at: item.created_at,
        provider: 'WHATSAPP',
        connection_params: item.connection_params,
        sources: item.sources || [],
        groups: item.groups || [],
      }));
    } catch (error) {
      this.logger.error('Failed to get WhatsApp accounts:', error);
      throw error;
    }
  }

  private mapAccountStatus(account: any): 'connected' | 'disconnected' | 'pending' | 'connecting' {
    if (account.connection_params && account.connection_params.status) {
      const status = account.connection_params.status.toLowerCase();
      if (status === 'active' || status === 'ok' || status === 'connected') {
        return 'connected';
      }
      if (status === 'credentials' || status === 'failed') {
        return 'disconnected';
      }
      if (status === 'checkpoint_required') {
        return 'pending';
      }
      if (status === 'connecting' || status === 'pending') {
        return 'connecting';
      }
      return 'disconnected';
    }
    
    return account.id ? 'connected' : 'disconnected';
  }

  /**
   * Get account details
   */
  async getAccount(accountId: string): Promise<any> {
    return this.makeRequest(`/api/v1/accounts/${accountId}`);
  }

  /**
   * Resync WhatsApp account
   */
  async resyncAccount(accountId: string): Promise<{ status: string }> {
    return this.makeRequest<{ status: string }>(`/api/v1/accounts/${accountId}/resync`, 'POST');
  }

  /**
   * Disconnect WhatsApp account
   */
  async disconnectAccount(accountId: string): Promise<{ success: boolean }> {
    try {
      await this.makeRequest(`/api/v1/accounts/${accountId}`, 'DELETE');
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to disconnect WhatsApp account:', error);
      return { success: false };
    }
  }
}

