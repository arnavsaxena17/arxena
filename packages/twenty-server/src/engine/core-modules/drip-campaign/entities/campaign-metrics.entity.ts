import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('campaign_metrics')
export class CampaignMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  campaignId: string;

  @Column({ type: 'int', default: 0 })
  totalSent: number;

  @Column({ type: 'int', default: 0 })
  totalDelivered: number;

  @Column({ type: 'int', default: 0 })
  totalOpened: number;

  @Column({ type: 'int', default: 0 })
  totalClicked: number;

  @Column({ type: 'int', default: 0 })
  totalReplied: number;

  @Column({ type: 'int', default: 0 })
  totalBounced: number;

  @Column({ type: 'int', default: 0 })
  totalUnsubscribed: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  openRate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  clickRate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  replyRate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  bounceRate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  unsubscribeRate: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  lastUpdated: Date;

  @ManyToOne('DripCampaign', 'metrics', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaignId' })
  campaign: any;
}
