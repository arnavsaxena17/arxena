import { InjectQueue } from '@nestjs/bull';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import { CampaignMetrics } from '../entities/campaign-metrics.entity';
import { DripCampaign } from '../entities/drip-campaign.entity';
import { EmailSequence } from '../entities/email-sequence.entity';
import { EmailTrackingService } from './email-tracking.service';

export interface CreateDripCampaignDto {
  name: string;
  description?: string;
  jobId: string;
  createdBy?: string;
}

export interface UpdateDripCampaignDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

@Injectable()
export class DripCampaignService {
  constructor(
    @InjectRepository(DripCampaign)
    private readonly dripCampaignRepository: Repository<DripCampaign>,
    @InjectRepository(EmailSequence)
    private readonly emailSequenceRepository: Repository<EmailSequence>,
    @InjectRepository(CampaignMetrics)
    private readonly campaignMetricsRepository: Repository<CampaignMetrics>,
    private readonly emailTrackingService: EmailTrackingService,
    @InjectQueue('drip-campaign')
    private readonly dripCampaignQueue: Queue,
  ) {}

  async createCampaign(createDto: CreateDripCampaignDto): Promise<DripCampaign> {
    const campaign = this.dripCampaignRepository.create(createDto);
    const savedCampaign = await this.dripCampaignRepository.save(campaign);

    // Create initial metrics record
    const metrics = this.campaignMetricsRepository.create({
      campaignId: savedCampaign.id,
    });
    await this.campaignMetricsRepository.save(metrics);

    return savedCampaign;
  }

  async findAllCampaigns(jobId?: string): Promise<DripCampaign[]> {
    const query = this.dripCampaignRepository
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.emailSequences', 'sequences')
      .leftJoinAndSelect('campaign.metrics', 'metrics')
      .orderBy('campaign.createdAt', 'DESC');

    if (jobId) {
      query.where('campaign.jobId = :jobId', { jobId });
    }

    return query.getMany();
  }

  async findCampaignById(id: string): Promise<DripCampaign> {
    const campaign = await this.dripCampaignRepository.findOne({
      where: { id },
      relations: ['emailSequences', 'metrics'],
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    return campaign;
  }

  async updateCampaign(id: string, updateDto: UpdateDripCampaignDto): Promise<DripCampaign> {
    const campaign = await this.findCampaignById(id);
    
    Object.assign(campaign, updateDto);
    campaign.updatedAt = new Date();
    
    return this.dripCampaignRepository.save(campaign);
  }

  async deleteCampaign(id: string): Promise<void> {
    const campaign = await this.findCampaignById(id);
    await this.dripCampaignRepository.remove(campaign);
  }

  async startCampaign(id: string): Promise<DripCampaign> {
    const campaign = await this.findCampaignById(id);
    
    if (!campaign.isActive) {
      campaign.isActive = true;
      await this.dripCampaignRepository.save(campaign);
    }

    // Add campaign to queue for processing
    await this.dripCampaignQueue.add('process-campaign', {
      campaignId: id,
    });

    return campaign;
  }

  async pauseCampaign(id: string): Promise<DripCampaign> {
    const campaign = await this.findCampaignById(id);
    campaign.isActive = false;
    campaign.updatedAt = new Date();
    
    return this.dripCampaignRepository.save(campaign);
  }

  async getCampaignMetrics(id: string): Promise<CampaignMetrics> {
    const campaign = await this.findCampaignById(id);
    
    if (!campaign.metrics || campaign.metrics.length === 0) {
      // Create metrics if they don't exist
      const metrics = this.campaignMetricsRepository.create({
        campaignId: id,
      });
      return this.campaignMetricsRepository.save(metrics);
    }

    // Update metrics with latest data
    const trackingData = await this.emailTrackingService.getCampaignTrackingData(id);
    const metrics = campaign.metrics[0];
    
    metrics.totalSent = trackingData.totalSent;
    metrics.totalDelivered = trackingData.totalDelivered;
    metrics.totalOpened = trackingData.totalOpened;
    metrics.totalClicked = trackingData.totalClicked;
    metrics.totalReplied = trackingData.totalReplied;
    metrics.totalBounced = trackingData.totalBounced;
    metrics.totalUnsubscribed = trackingData.totalUnsubscribed;
    
    // Calculate rates
    metrics.openRate = metrics.totalSent > 0 ? metrics.totalOpened / metrics.totalSent : 0;
    metrics.clickRate = metrics.totalSent > 0 ? metrics.totalClicked / metrics.totalSent : 0;
    metrics.replyRate = metrics.totalSent > 0 ? metrics.totalReplied / metrics.totalSent : 0;
    metrics.bounceRate = metrics.totalSent > 0 ? metrics.totalBounced / metrics.totalSent : 0;
    metrics.unsubscribeRate = metrics.totalSent > 0 ? metrics.totalUnsubscribed / metrics.totalSent : 0;
    
    metrics.lastUpdated = new Date();
    
    return this.campaignMetricsRepository.save(metrics);
  }

  async getCampaignsByJobId(jobId: string): Promise<DripCampaign[]> {
    return this.findAllCampaigns(jobId);
  }
}
