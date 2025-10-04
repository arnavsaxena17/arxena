import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { EmailStatus, EmailTracking } from '../entities/email-tracking.entity';

export interface CreateEmailTrackingDto {
  campaignId: string;
  sequenceId: string;
  recipientId: string;
  recipientEmail: string;
  trackingPixelId?: string;
  replyTrackingId?: string;
}

export interface UpdateEmailTrackingDto {
  status?: EmailStatus;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  repliedAt?: Date;
  bouncedAt?: Date;
  unsubscribedAt?: Date;
  bounceReason?: string;
  clickUrl?: string;
}

@Injectable()
export class EmailTrackingService {
  constructor(
    @InjectRepository(EmailTracking)
    private readonly emailTrackingRepository: Repository<EmailTracking>,
  ) {}

  async createTracking(createDto: CreateEmailTrackingDto): Promise<EmailTracking> {
    const tracking = this.emailTrackingRepository.create({
      ...createDto,
      trackingPixelId: createDto.trackingPixelId || uuidv4(),
      replyTrackingId: createDto.replyTrackingId || uuidv4(),
    });

    return this.emailTrackingRepository.save(tracking);
  }

  async updateTracking(id: string, updateDto: UpdateEmailTrackingDto): Promise<EmailTracking> {
    const tracking = await this.emailTrackingRepository.findOne({
      where: { id },
    });

    if (!tracking) {
      throw new Error(`Email tracking with ID ${id} not found`);
    }

    Object.assign(tracking, updateDto);
    tracking.updatedAt = new Date();

    return this.emailTrackingRepository.save(tracking);
  }

  async updateTrackingByPixelId(pixelId: string, updateDto: UpdateEmailTrackingDto): Promise<EmailTracking> {
    const tracking = await this.emailTrackingRepository.findOne({
      where: { trackingPixelId: pixelId },
    });

    if (!tracking) {
      throw new Error(`Email tracking with pixel ID ${pixelId} not found`);
    }

    return this.updateTracking(tracking.id, updateDto);
  }

  async updateTrackingByReplyId(replyId: string, updateDto: UpdateEmailTrackingDto): Promise<EmailTracking> {
    const tracking = await this.emailTrackingRepository.findOne({
      where: { replyTrackingId: replyId },
    });

    if (!tracking) {
      throw new Error(`Email tracking with reply ID ${replyId} not found`);
    }

    return this.updateTracking(tracking.id, updateDto);
  }

  async getTrackingByPixelId(pixelId: string): Promise<EmailTracking | null> {
    return this.emailTrackingRepository.findOne({
      where: { trackingPixelId: pixelId },
    });
  }

  async getTrackingByReplyId(replyId: string): Promise<EmailTracking | null> {
    return this.emailTrackingRepository.findOne({
      where: { replyTrackingId: replyId },
    });
  }

  async getCampaignTrackingData(campaignId: string): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    totalReplied: number;
    totalBounced: number;
    totalUnsubscribed: number;
  }> {
    const result = await this.emailTrackingRepository
      .createQueryBuilder('tracking')
      .select([
        'COUNT(*) as totalSent',
        'SUM(CASE WHEN status = :delivered OR status = :opened OR status = :clicked OR status = :replied THEN 1 ELSE 0 END) as totalDelivered',
        'SUM(CASE WHEN status = :opened OR status = :clicked OR status = :replied THEN 1 ELSE 0 END) as totalOpened',
        'SUM(CASE WHEN status = :clicked OR status = :replied THEN 1 ELSE 0 END) as totalClicked',
        'SUM(CASE WHEN status = :replied THEN 1 ELSE 0 END) as totalReplied',
        'SUM(CASE WHEN status = :bounced THEN 1 ELSE 0 END) as totalBounced',
        'SUM(CASE WHEN status = :unsubscribed THEN 1 ELSE 0 END) as totalUnsubscribed',
      ])
      .where('tracking.campaignId = :campaignId', { campaignId })
      .setParameters({
        delivered: EmailStatus.DELIVERED,
        opened: EmailStatus.OPENED,
        clicked: EmailStatus.CLICKED,
        replied: EmailStatus.REPLIED,
        bounced: EmailStatus.BOUNCED,
        unsubscribed: EmailStatus.UNSUBSCRIBED,
      })
      .getRawOne();

    return {
      totalSent: parseInt(result.totalSent) || 0,
      totalDelivered: parseInt(result.totalDelivered) || 0,
      totalOpened: parseInt(result.totalOpened) || 0,
      totalClicked: parseInt(result.totalClicked) || 0,
      totalReplied: parseInt(result.totalReplied) || 0,
      totalBounced: parseInt(result.totalBounced) || 0,
      totalUnsubscribed: parseInt(result.totalUnsubscribed) || 0,
    };
  }

  async getRecipientTrackingHistory(recipientEmail: string, campaignId?: string): Promise<EmailTracking[]> {
    const query = this.emailTrackingRepository
      .createQueryBuilder('tracking')
      .where('tracking.recipientEmail = :recipientEmail', { recipientEmail })
      .orderBy('tracking.sentAt', 'DESC');

    if (campaignId) {
      query.andWhere('tracking.campaignId = :campaignId', { campaignId });
    }

    return query.getMany();
  }

  async getSequenceTrackingData(sequenceId: string): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    totalReplied: number;
    totalBounced: number;
    totalUnsubscribed: number;
  }> {
    const result = await this.emailTrackingRepository
      .createQueryBuilder('tracking')
      .select([
        'COUNT(*) as totalSent',
        'SUM(CASE WHEN status = :delivered OR status = :opened OR status = :clicked OR status = :replied THEN 1 ELSE 0 END) as totalDelivered',
        'SUM(CASE WHEN status = :opened OR status = :clicked OR status = :replied THEN 1 ELSE 0 END) as totalOpened',
        'SUM(CASE WHEN status = :clicked OR status = :replied THEN 1 ELSE 0 END) as totalClicked',
        'SUM(CASE WHEN status = :replied THEN 1 ELSE 0 END) as totalReplied',
        'SUM(CASE WHEN status = :bounced THEN 1 ELSE 0 END) as totalBounced',
        'SUM(CASE WHEN status = :unsubscribed THEN 1 ELSE 0 END) as totalUnsubscribed',
      ])
      .where('tracking.sequenceId = :sequenceId', { sequenceId })
      .setParameters({
        delivered: EmailStatus.DELIVERED,
        opened: EmailStatus.OPENED,
        clicked: EmailStatus.CLICKED,
        replied: EmailStatus.REPLIED,
        bounced: EmailStatus.BOUNCED,
        unsubscribed: EmailStatus.UNSUBSCRIBED,
      })
      .getRawOne();

    return {
      totalSent: parseInt(result.totalSent) || 0,
      totalDelivered: parseInt(result.totalDelivered) || 0,
      totalOpened: parseInt(result.totalOpened) || 0,
      totalClicked: parseInt(result.totalClicked) || 0,
      totalReplied: parseInt(result.totalReplied) || 0,
      totalBounced: parseInt(result.totalBounced) || 0,
      totalUnsubscribed: parseInt(result.totalUnsubscribed) || 0,
    };
  }
}
