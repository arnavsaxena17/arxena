// src/services/avatar.service.ts
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { firstValueFrom } from 'rxjs';

@Injectable()
export class AvatarService {
  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  async createToken(): Promise<string> {
    const apiKey = this.configService.get<string>('HEYGEN_API_KEY');

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          'https://api.heygen.com/v1/streaming.create_token',
          {},
          {
            headers: {
              'x-api-key': apiKey,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.data.data.token;
    } catch (error) {
      console.error('Error creating HeyGen token:', error);
      throw new Error('Failed to create avatar token');
    }
  }
}
