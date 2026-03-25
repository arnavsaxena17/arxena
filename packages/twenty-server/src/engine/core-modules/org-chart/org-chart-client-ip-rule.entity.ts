import { Field, ObjectType } from '@nestjs/graphql';

import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@Entity({ name: 'org_chart_client_ip_rule', schema: 'core' })
@ObjectType('OrgChartClientIpRule')
@Index('UQ_ORG_CHART_CLIENT_IP_RULE_IP', ['ipAddress'], { unique: true })
export class OrgChartClientIpRuleEntity {
  @Field(() => UUIDScalarType)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ type: 'varchar', length: 64 })
  ipAddress: string;

  @Field()
  @Column({ type: 'boolean', default: false })
  isBlocked: boolean;

  /**
   * When true, skip Elasticsearch for this client; only Redis, S3, or blank
   * placeholder are used (reduces load for abusive IPs you still allow).
   */
  @Field()
  @Column({ type: 'boolean', default: false })
  serveCachedOnly: boolean;

  @Field()
  @Column({ type: 'int', default: 0 })
  totalRequests: number;

  @Field()
  @Column({ type: 'int', default: 0 })
  chartsServed: number;

  /** Latest User-Agent seen for this IP (from org-chart requests only). */
  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 1024, nullable: true })
  lastUserAgent: string | null;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
