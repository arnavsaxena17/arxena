import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Relation,
} from 'typeorm';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';

export enum PrivacyConsentActionEnum {
  ACCEPT_ALL = 'accept_all',
  REJECT_ALL = 'reject_all',
  CUSTOM = 'custom',
  WITHDRAW = 'withdraw',
}

export enum PrivacyConsentTypeEnum {
  COOKIE_BANNER = 'cookie_banner',
  TERMS_AT_SIGNUP = 'terms_at_signup',
}

export enum PrivacyConsentSourceEnum {
  WEBSITE = 'website',
  APP = 'app',
}

registerEnumType(PrivacyConsentActionEnum, {
  name: 'PrivacyConsentAction',
});

registerEnumType(PrivacyConsentTypeEnum, {
  name: 'PrivacyConsentType',
});

registerEnumType(PrivacyConsentSourceEnum, {
  name: 'PrivacyConsentSource',
});

export type PrivacyConsentCategoriesJson = {
  necessary: true;
  analytics: boolean;
  functional: boolean;
};

@ObjectType('PrivacyConsentEvent')
@Entity({ name: 'privacy_consent_event', schema: 'core' })
@Index('IDX_PRIVACY_CONSENT_VISITOR_ID', ['visitorId'])
@Index('IDX_PRIVACY_CONSENT_USER_ID', ['userId'])
export class PrivacyConsentEventEntity {
  @Field(() => UUIDScalarType)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => UUIDScalarType, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: Relation<UserEntity> | null;

  @Field(() => UUIDScalarType)
  @Column({ type: 'uuid' })
  visitorId: string;

  @Field(() => PrivacyConsentTypeEnum)
  @Column({
    type: 'enum',
    enum: PrivacyConsentTypeEnum,
  })
  consentType: PrivacyConsentTypeEnum;

  @Field()
  @Column({ type: 'varchar', length: 32 })
  policyVersion: string;

  @Field(() => PrivacyConsentActionEnum)
  @Column({
    type: 'enum',
    enum: PrivacyConsentActionEnum,
  })
  action: PrivacyConsentActionEnum;

  @Field(() => String)
  @Column({ type: 'jsonb' })
  categories: PrivacyConsentCategoriesJson;

  @Field(() => PrivacyConsentSourceEnum)
  @Column({
    type: 'enum',
    enum: PrivacyConsentSourceEnum,
  })
  source: PrivacyConsentSourceEnum;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 1024, nullable: true })
  userAgent: string | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 16, nullable: true })
  locale: string | null;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  linkedAt: Date | null;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
