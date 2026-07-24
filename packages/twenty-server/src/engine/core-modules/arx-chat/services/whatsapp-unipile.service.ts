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
        
        // Use warning level for 404s (expected when accounts don't exist)
        if (response.status === 404) {
          this.logger.warn(`Unipile API 404: ${response.statusText}`, errorData);
        } else {
          this.logger.error(`Unipile API error: ${response.status} ${response.statusText}`, errorData);
        }
        
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // Only log as error if it's not already logged above
      if (!(error instanceof Error && error.message.includes('HTTP 404'))) {
        this.logger.error('Unipile API request failed:', error);
      }
      throw error;
    }
  }
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

