// import { Injectable } from '@nestjs/common';
// import { HttpService } from '@nestjs/axios';

// import { ConfigService } from '@nestjs/config';

// @Injectable()
// export class InterviewService {
//   private baseUrl: string;
//   private apiKey: string;

//   constructor(
//     private httpService: HttpService,
//     private configService: ConfigService,
//   ) {
//     this.baseUrl = this.configService.get<string>('A2E_BASE_URL', 'http://localhost:5000/api');
//     this.apiKey = this.configService.get<string>('A2E_API_KEY', ''); 
//   }

//   private getHeaders() {
//     return {
//       'Content-Type': 'application/json',
//       'Authorization': `Bearer ${this.apiKey}`,
//     };
//   }

//   async getAvatars() {
//     const response = await this.httpService
//       .get(`${this.baseUrl}/avatars`, { headers: this.getHeaders() })
//       .toPromise();
//     return response.data;
//   }

//   async createSession(avatarId: string) {
//     const payload = {
//       avatar_id: avatarId,
//       expire_seconds: 300, // 5 minutes
//     };

//     const response = await this.httpService
//       .post(`${this.baseUrl}/session/create`, payload, { headers: this.getHeaders() })
//       .toPromise();
//     return response.data;
//   }

//   async setContext(channel: string, context: string) {
//     const payload = {
//       channel,
//       context,
//     };

//     const response = await this.httpService
//       .post(`${this.baseUrl}/session/set-context`, payload, { headers: this.getHeaders() })
//       .toPromise();
//     return response.data;
//   }

//   async askQuestion(channel: string, question: string) {
//     const payload = {
//       channel,
//       question,
//     };

//     const response = await this.httpService
//       .post(`${this.baseUrl}/session/ask`, payload, { headers: this.getHeaders() })
//       .toPromise();
//     return response.data;
//   }

//   async speakDirectly(channel: string, text: string) {
//     const payload = {
//       channel,
//       text,
//     };

//     const response = await this.httpService
//       .post(`${this.baseUrl}/session/speak`, payload, { headers: this.getHeaders() })
//       .toPromise();
//     return response.data;
//   }

//   async closeSession(channel: string) {
//     const payload = {
//       channel,
//     };

//     const response = await this.httpService
//       .post(`${this.baseUrl}/session/close`, payload, { headers: this.getHeaders() })
//       .toPromise();
//     return response.data;
//   }
// }