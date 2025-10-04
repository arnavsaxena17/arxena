import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DripCampaign } from '../entities/drip-campaign.entity';
import { EmailSequence } from '../entities/email-sequence.entity';

export interface CreateEmailSequenceDto {
  name: string;
  subject: string;
  content: string;
  delayDays?: number;
  delayHours?: number;
  delayMinutes?: number;
  order: number;
  isActive?: boolean;
  campaignId: string;
}

export interface UpdateEmailSequenceDto {
  name?: string;
  subject?: string;
  content?: string;
  delayDays?: number;
  delayHours?: number;
  delayMinutes?: number;
  order?: number;
  isActive?: boolean;
}

@Injectable()
export class EmailSequenceService {
  constructor(
    @InjectRepository(EmailSequence)
    private readonly emailSequenceRepository: Repository<EmailSequence>,
    @InjectRepository(DripCampaign)
    private readonly dripCampaignRepository: Repository<DripCampaign>,
  ) {}

  async createSequence(createDto: CreateEmailSequenceDto): Promise<EmailSequence> {
    // Verify campaign exists
    const campaign = await this.dripCampaignRepository.findOne({
      where: { id: createDto.campaignId },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${createDto.campaignId} not found`);
    }

    const sequence = this.emailSequenceRepository.create(createDto);
    return this.emailSequenceRepository.save(sequence);
  }

  async findSequencesByCampaignId(campaignId: string): Promise<EmailSequence[]> {
    return this.emailSequenceRepository.find({
      where: { campaignId },
      order: { order: 'ASC' },
    });
  }

  async findSequenceById(id: string): Promise<EmailSequence> {
    const sequence = await this.emailSequenceRepository.findOne({
      where: { id },
      relations: ['campaign'],
    });

    if (!sequence) {
      throw new NotFoundException(`Email sequence with ID ${id} not found`);
    }

    return sequence;
  }

  async updateSequence(id: string, updateDto: UpdateEmailSequenceDto): Promise<EmailSequence> {
    const sequence = await this.findSequenceById(id);
    
    Object.assign(sequence, updateDto);
    sequence.updatedAt = new Date();
    
    return this.emailSequenceRepository.save(sequence);
  }

  async deleteSequence(id: string): Promise<void> {
    const sequence = await this.findSequenceById(id);
    await this.emailSequenceRepository.remove(sequence);
  }

  async reorderSequences(campaignId: string, sequenceIds: string[]): Promise<EmailSequence[]> {
    const sequences = await this.findSequencesByCampaignId(campaignId);
    
    // Update order for each sequence
    for (let i = 0; i < sequenceIds.length; i++) {
      const sequence = sequences.find(s => s.id === sequenceIds[i]);
      if (sequence) {
        sequence.order = i;
        await this.emailSequenceRepository.save(sequence);
      }
    }

    return this.findSequencesByCampaignId(campaignId);
  }

  async getNextSequenceForCampaign(campaignId: string, currentOrder: number): Promise<EmailSequence | null> {
    return this.emailSequenceRepository.findOne({
      where: {
        campaignId,
        order: currentOrder + 1,
        isActive: true,
      },
      order: { order: 'ASC' },
    });
  }

  async getActiveSequencesForCampaign(campaignId: string): Promise<EmailSequence[]> {
    return this.emailSequenceRepository.find({
      where: {
        campaignId,
        isActive: true,
      },
      order: { order: 'ASC' },
    });
  }
}
