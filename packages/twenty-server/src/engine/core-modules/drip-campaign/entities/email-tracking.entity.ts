import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum EmailStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  OPENED = 'opened',
  CLICKED = 'clicked',
  REPLIED = 'replied',
  BOUNCED = 'bounced',
  UNSUBSCRIBED = 'unsubscribed',
}

@Entity('email_tracking')
export class EmailTracking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  campaignId: string;

  @Column({ type: 'uuid' })
  sequenceId: string;

  @Column({ type: 'varchar', length: 255 })
  recipientId: string;

  @Column({ type: 'varchar', length: 255 })
  recipientEmail: string;

  @Column({ 
    type: 'enum', 
    enum: EmailStatus, 
    default: EmailStatus.SENT 
  })
  status: EmailStatus;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  sentAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  openedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  clickedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  repliedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  bouncedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  unsubscribedAt: Date;

  @Column({ type: 'varchar', length: 255 })
  trackingPixelId: string;

  @Column({ type: 'varchar', length: 255 })
  replyTrackingId: string;

  @Column({ type: 'text', nullable: true })
  bounceReason: string;

  @Column({ type: 'text', nullable: true })
  clickUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne('DripCampaign', 'emailTrackings', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaignId' })
  campaign: any;
}
