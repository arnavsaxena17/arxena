import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

import {
  PermissionFlagType,
  PermissionsOnAllObjectRecords,
} from 'twenty-shared/constants';
import { type APP_LOCALES, SOURCE_LOCALE } from 'twenty-shared/translations';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { TwoFactorAuthenticationMethodSummaryDTO } from 'src/engine/core-modules/two-factor-authentication/dto/two-factor-authentication-method.dto';
import { TwoFactorAuthenticationMethodEntity } from 'src/engine/core-modules/two-factor-authentication/entities/two-factor-authentication-method.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { ObjectPermissionDTO } from 'src/engine/metadata-modules/object-permission/dtos/object-permission.dto';
import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

registerEnumType(PermissionFlagType, {
  name: 'PermissionFlagType',
});

registerEnumType(PermissionsOnAllObjectRecords, {
  name: 'PermissionsOnAllObjectRecords',
});

@Entity({ name: 'userWorkspace', schema: 'core' })
@ObjectType('UserWorkspace')
@Index(
  'IDX_USER_WORKSPACE_USER_ID_WORKSPACE_ID_UNIQUE',
  ['userId', 'workspaceId'],
  {
    unique: true,
    where: '"deletedAt" IS NULL',
  },
)
@Index('IDX_USER_WORKSPACE_USER_ID', ['userId'])
@Index('IDX_USER_WORKSPACE_WORKSPACE_ID', ['workspaceId'])
export class UserWorkspaceEntity extends WorkspaceRelatedEntity {
  @Field(() => UUIDScalarType)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => UserEntity)
  @ManyToOne(() => UserEntity, (user) => user.userWorkspaces, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: Relation<UserEntity>;

  @Field(() => UUIDScalarType, { nullable: false })
  @Column()
  userId: string;

  @Column({ nullable: true })
  defaultAvatarUrl: string;

  @Field(() => String, { nullable: false })
  @Column({ nullable: false, default: SOURCE_LOCALE, type: 'varchar' })
  locale: keyof typeof APP_LOCALES;

  // WhatsApp agent channel: the verified connection between one phone and one workspace.
  // Deliberately not exposed over GraphQL yet (no @Field) so the schema does not churn.
  @Column({ nullable: true, type: 'varchar' })
  whatsappPhoneE164: string | null;

  @Column({ nullable: true, type: 'varchar' })
  whatsappAgentNumberId: string | null;

  @Column({ nullable: true, type: 'uuid' })
  whatsappActiveThreadId: string | null;

  @Column({ nullable: true, type: 'timestamptz' })
  whatsappConnectedAt: Date | null;

  @Column({ nullable: true, type: 'timestamptz' })
  whatsappLastInboundAt: Date | null;

  @Column({ nullable: true, type: 'varchar' })
  whatsappStatus: string | null;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Field({ nullable: true })
  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date;

  @OneToMany(
    () => TwoFactorAuthenticationMethodEntity,
    (twoFactorAuthenticationMethod) =>
      twoFactorAuthenticationMethod.userWorkspace,
    { nullable: true },
  )
  twoFactorAuthenticationMethods: Relation<
    TwoFactorAuthenticationMethodEntity[]
  >;

  @Field(() => [PermissionFlagType], { nullable: true })
  permissionFlags?: PermissionFlagType[];

  @Field(() => [ObjectPermissionDTO], { nullable: true })
  objectPermissions?: ObjectPermissionDTO[];

  @Field(() => [ObjectPermissionDTO], { nullable: true })
  objectsPermissions?: ObjectPermissionDTO[];

  @Field(() => [TwoFactorAuthenticationMethodSummaryDTO], { nullable: true })
  twoFactorAuthenticationMethodSummary?: TwoFactorAuthenticationMethodSummaryDTO[];
}
