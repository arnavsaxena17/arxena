import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import axios from 'axios';

const ARXENA_API_KEY =
  'ZWRkNDJhYWVmZjA2NDg1ZDkxNjBmYmYxYTdiYjFkZjYtMTcyMTQxOTEzNg==';
const VOLK_API_KEY =
  'YWJmNzM3NWM3ZWY3NDA5MWExZjFhYzM2NzM1NDJjMDMtMTcyOTA3MzU4NQ==';

@Injectable()
export class HeygenService {
  private readonly logger = new Logger(HeygenService.name);
  private readonly HEYGEN_API_BASE_URL = 'https://api.heygen.com';
  private readonly heygenApiKey: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = process.env.HEYGEN_API_KEY;

    if (!apiKey) {
      throw new Error('HEYGEN_API_KEY is not configured');
    }
    this.heygenApiKey = apiKey;
  }

  async getToken() {
    if (!this.heygenApiKey) {
      throw new UnauthorizedException('HeyGen API key is not configured');
    }
    console.log('this.heygenApiKey', this.heygenApiKey);
    const res = await fetch(
      `${this.HEYGEN_API_BASE_URL}/v1/streaming.create_token`,
      {
        method: 'POST',
        headers: {
          'x-api-key': this.heygenApiKey,
        },
      },
    );

    const data = await res.json();

    console.log('data', data);
    const token = data.data.token;

    console.log('token', token);

    return token;
  }

  async startStreamingAvatar(): Promise<string> {
    try {
      const response = await axios.post(
        `${this.HEYGEN_API_BASE_URL}/streaming/start`,
        {},
        {
          headers: {
            'x-api-key': this.heygenApiKey,
          },
        },
      );

      return response.data.streamId;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`HeyGen start avatar failed: ${error.message}`);
        throw new HttpException(
          `HeyGen start failed: ${error.response?.data || error.message}`,
          error.response?.status || HttpStatus.BAD_REQUEST,
        );
      }
      throw error;
    }
  }

  async sendDialogueToAvatar(streamId: string, text: string): Promise<void> {
    try {
      const response = await axios.post(
        `${this.HEYGEN_API_BASE_URL}/streaming/${streamId}/dialogue`,
        { text },
        {
          headers: {
            'x-api-key': this.heygenApiKey,
          },
        },
      );

      if (response.status !== 200) {
        this.logger.warn(`Non-200 response from HeyGen: ${response.status}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`HeyGen dialogue failed: ${error.message}`);
        throw new HttpException(
          `HeyGen dialogue failed: ${error.response?.data || error.message}`,
          error.response?.status || HttpStatus.BAD_REQUEST,
        );
      }
      throw error;
    }
  }

  async stopStreamingAvatar(streamId: string): Promise<void> {
    try {
      await axios.post(
        `${this.HEYGEN_API_BASE_URL}/streaming/${streamId}/stop`,
        {},
        {
          headers: {
            'x-api-key': this.heygenApiKey,
          },
        },
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`HeyGen stop failed: ${error.message}`);
        throw new HttpException(
          `HeyGen stop failed: ${error.response?.data || error.message}`,
          error.response?.status || HttpStatus.BAD_REQUEST,
        );
      }
      throw error;
    }
  }
}
