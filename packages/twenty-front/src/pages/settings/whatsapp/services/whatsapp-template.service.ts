// src/services/whatsapp-template.service.ts

import axios, { AxiosInstance } from 'axios';

export interface Template {
  id?: string;
  name: string;
  language: string;
  category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  status?: 'APPROVED' | 'PENDING' | 'REJECTED';
  components: TemplateComponent[];
  message_send_ttl_seconds?: number;
  allow_category_change?: boolean;
}

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
  };
  buttons?: TemplateButton[];
}

export interface TemplateButton {
  type: 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY';
  text: string;
  url?: string;
  phone_number?: string;
}

export interface TemplateResponse {
  id: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  category: string;
}

export interface GetTemplatesResponse {
  data: Template[];
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
    next?: string;
  };
}

export class WhatsAppTemplateService {
  private api: AxiosInstance;
  private static instance: WhatsAppTemplateService;

  private constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_WHATSAPP_API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for auth
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  public static getInstance(): WhatsAppTemplateService {
    if (!WhatsAppTemplateService.instance) {
      WhatsAppTemplateService.instance = new WhatsAppTemplateService();
    }
    return WhatsAppTemplateService.instance;
  }

  private handleError(error: any): never {
    const message = error.response?.data?.error?.message || 'An error occurred';
    const code = error.response?.data?.error?.code;
    throw new Error(`${message}${code ? ` (Code: ${code})` : ''}`);
  }

  async createTemplate(template: Omit<Template, 'id' | 'status'>): Promise<TemplateResponse> {
    try {
      const response = await this.api.post<TemplateResponse>('/templates', template);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getTemplates(params: {
    fields?: string[];
    limit?: number;
    status?: Template['status'];
  } = {}): Promise<GetTemplatesResponse> {
    try {
      const response = await this.api.get<GetTemplatesResponse>('/templates', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateTemplate(id: string, updates: Partial<Template>): Promise<TemplateResponse> {
    try {
      const response = await this.api.put<TemplateResponse>(`/templates/${id}`, updates);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    try {
      await this.api.delete(`/templates/${id}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getTemplateById(id: string): Promise<Template> {
    try {
      const response = await this.api.get<Template>(`/templates/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

export const templateService = WhatsAppTemplateService.getInstance();