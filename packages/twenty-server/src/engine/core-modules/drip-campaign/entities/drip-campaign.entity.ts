import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('drip_campaigns')
export class DripCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 255 })
  jobId: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany('EmailSequence', 'campaign', { cascade: true })
  emailSequences: any[];

  @OneToMany('EmailTracking', 'campaign')
  emailTrackings: any[];

  @OneToMany('CampaignMetrics', 'campaign')
  metrics: any[];
}
