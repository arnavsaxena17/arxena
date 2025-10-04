import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { CreateDripCampaignDto, DripCampaignService, UpdateDripCampaignDto } from '../services/drip-campaign.service';
import { CreateEmailSequenceDto, EmailSequenceService, UpdateEmailSequenceDto } from '../services/email-sequence.service';
import { EmailTrackingService } from '../services/email-tracking.service';

@Controller('drip-campaigns')
@UseGuards(JwtAuthGuard)
export class DripCampaignController {
  constructor(
    private readonly dripCampaignService: DripCampaignService,
    private readonly emailSequenceService: EmailSequenceService,
    private readonly emailTrackingService: EmailTrackingService,
  ) {}

  // Campaign endpoints
  @Post()
  async createCampaign(@Body() createDto: CreateDripCampaignDto) {
    return this.dripCampaignService.createCampaign(createDto);
  }

  @Get()
  async findAllCampaigns(@Query('jobId') jobId?: string) {
    return this.dripCampaignService.findAllCampaigns(jobId);
  }

  @Get(':id')
  async findCampaignById(@Param('id') id: string) {
    return this.dripCampaignService.findCampaignById(id);
  }

  @Put(':id')
  async updateCampaign(@Param('id') id: string, @Body() updateDto: UpdateDripCampaignDto) {
    return this.dripCampaignService.updateCampaign(id, updateDto);
  }

  @Delete(':id')
  async deleteCampaign(@Param('id') id: string) {
    await this.dripCampaignService.deleteCampaign(id);
    return { message: 'Campaign deleted successfully' };
  }

  @Post(':id/start')
  async startCampaign(@Param('id') id: string) {
    return this.dripCampaignService.startCampaign(id);
  }

  @Post(':id/pause')
  async pauseCampaign(@Param('id') id: string) {
    return this.dripCampaignService.pauseCampaign(id);
  }

  @Get(':id/metrics')
  async getCampaignMetrics(@Param('id') id: string) {
    return this.dripCampaignService.getCampaignMetrics(id);
  }

  @Get('job/:jobId')
  async getCampaignsByJobId(@Param('jobId') jobId: string) {
    return this.dripCampaignService.getCampaignsByJobId(jobId);
  }

  // Email sequence endpoints
  @Post('sequences')
  async createEmailSequence(@Body() createDto: CreateEmailSequenceDto) {
    return this.emailSequenceService.createSequence(createDto);
  }

  @Get('campaigns/:campaignId/sequences')
  async getSequencesByCampaignId(@Param('campaignId') campaignId: string) {
    return this.emailSequenceService.findSequencesByCampaignId(campaignId);
  }

  @Get('sequences/:id')
  async getSequenceById(@Param('id') id: string) {
    return this.emailSequenceService.findSequenceById(id);
  }

  @Put('sequences/:id')
  async updateSequence(@Param('id') id: string, @Body() updateDto: UpdateEmailSequenceDto) {
    return this.emailSequenceService.updateSequence(id, updateDto);
  }

  @Delete('sequences/:id')
  async deleteSequence(@Param('id') id: string) {
    await this.emailSequenceService.deleteSequence(id);
    return { message: 'Email sequence deleted successfully' };
  }

  @Put('campaigns/:campaignId/sequences/reorder')
  async reorderSequences(
    @Param('campaignId') campaignId: string,
    @Body('sequenceIds') sequenceIds: string[],
  ) {
    return this.emailSequenceService.reorderSequences(campaignId, sequenceIds);
  }

  // Email tracking endpoints
  @Post('tracking')
  async createEmailTracking(@Body() createDto: any) {
    return this.emailTrackingService.createTracking(createDto);
  }

  @Get('tracking/pixel/:pixelId')
  async getTrackingByPixelId(@Param('pixelId') pixelId: string) {
    return this.emailTrackingService.getTrackingByPixelId(pixelId);
  }

  @Get('tracking/reply/:replyId')
  async getTrackingByReplyId(@Param('replyId') replyId: string) {
    return this.emailTrackingService.getTrackingByReplyId(replyId);
  }

  @Put('tracking/pixel/:pixelId')
  async updateTrackingByPixelId(
    @Param('pixelId') pixelId: string,
    @Body() updateDto: any,
  ) {
    return this.emailTrackingService.updateTrackingByPixelId(pixelId, updateDto);
  }

  @Put('tracking/reply/:replyId')
  async updateTrackingByReplyId(
    @Param('replyId') replyId: string,
    @Body() updateDto: any,
  ) {
    return this.emailTrackingService.updateTrackingByReplyId(replyId, updateDto);
  }

  @Get('campaigns/:campaignId/tracking')
  async getCampaignTrackingData(@Param('campaignId') campaignId: string) {
    return this.emailTrackingService.getCampaignTrackingData(campaignId);
  }

  @Get('sequences/:sequenceId/tracking')
  async getSequenceTrackingData(@Param('sequenceId') sequenceId: string) {
    return this.emailTrackingService.getSequenceTrackingData(sequenceId);
  }

  @Get('tracking/recipient/:recipientEmail')
  async getRecipientTrackingHistory(
    @Param('recipientEmail') recipientEmail: string,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.emailTrackingService.getRecipientTrackingHistory(recipientEmail, campaignId);
  }
}
