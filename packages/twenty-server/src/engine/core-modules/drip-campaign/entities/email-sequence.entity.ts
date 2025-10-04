import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('email_sequences')
export class EmailSequence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500 })
  subject: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'int', default: 0 })
  delayDays: number;

  @Column({ type: 'int', default: 0 })
  delayHours: number;

  @Column({ type: 'int', default: 0 })
  delayMinutes: number;

  @Column({ type: 'int' })
  order: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'uuid' })
  campaignId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne('DripCampaign', 'emailSequences', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaignId' })
  campaign: any;
}
