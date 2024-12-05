import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import { JobService } from '../services/job.service';
import { PersonService } from '../services/person.service';
import { CandidateService } from '../services/candidate.service';
import { ChatService } from '../services/chat.service';
import * as CandidateSourcingTypes from '../types/candidate-sourcing-types';

@Controller('candidate-sourcing')
export class CandidateSourcingController {
  constructor(
    private readonly jobService: JobService,
    private readonly personService: PersonService,
    private readonly candidateService: CandidateService,
    private readonly chatService: ChatService
  ) {}

  @Post('process-candidate-chats')
  @UseGuards(JwtAuthGuard)
  async processCandidateChats(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    return this.chatService.processCandidateChats(apiToken);
  }

  @Post('refresh-chat-status-by-candidates')
  @UseGuards(JwtAuthGuard)
  async refreshChats(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    const { candidateIds, currentWorkspaceMemberId } = request.body;
    return this.chatService.refreshChats(candidateIds, currentWorkspaceMemberId, apiToken);
  }

  // @Post('post-candidates')
  // @UseGuards(JwtAuthGuard)
  // async sourceCandidates(@Req() req) {
  //   const apiToken = req.headers.authorization.split(' ')[1];
  //   const { job_id, job_name, data } = req.body;
  //   return this.candidateService.sourceCandidates(job_id, job_name, data, apiToken);
  // }

  @Post('create-job-in-arxena')
  @UseGuards(JwtAuthGuard)
  async createJobInArxena(@Req() req): Promise<any> {
    const apiToken = req.headers.authorization.split(' ')[1];
    return this.jobService.createJobInArxena(req.body, apiToken);
  }

  @Post('get-all-jobs')
  @UseGuards(JwtAuthGuard)
  async getJobs(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1];
    return this.jobService.getAllJobs(apiToken);
  }

  @Post('test-arxena-connection')
  @UseGuards(JwtAuthGuard)
  async testArxenaConnection(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1];
    return this.jobService.testArxenaConnection(apiToken);
  }

  @Post('post-job')
  @UseGuards(JwtAuthGuard)
  async postJob(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1];
    return this.jobService.postJob(request.body, apiToken);
  }

  @Post('add-questions')
  @UseGuards(JwtAuthGuard)
  async addQuestions(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1];
    return this.jobService.addQuestions(request.body, apiToken);
  }

  @Post('start-chat')
  @UseGuards(JwtAuthGuard)
  async startChat(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1];
    return this.chatService.startChat(request.body.candidateId, apiToken);
  }

  @Post('stop-chat')
  @UseGuards(JwtAuthGuard)
  async stopChat(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1];
    return this.chatService.stopChat(request.body.candidateId, apiToken);
  }

  @Post('fetch-candidate-by-phone-number-start-chat')
  @UseGuards(JwtAuthGuard)
  async fetchCandidateByPhoneNumber(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1];
    return this.chatService.fetchCandidateByPhoneNumberAndStartChat(
      request.body.phoneNumber,
      apiToken
    );
  }
}