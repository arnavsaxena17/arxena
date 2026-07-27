import { Field, ObjectType } from '@nestjs/graphql';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import type { EncryptedString } from 'src/engine/core-modules/secret-encryption/branded-strings/encrypted-string.type';
import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

@Index('IDX_AI_PROVIDER_CREDENTIAL_WORKSPACE_ID', ['workspaceId'])
@Unique('IDX_AI_PROVIDER_CREDENTIAL_WORKSPACE_ID_PROVIDER_NAME_UNIQUE', [
  'workspaceId',
  'providerName',
])
@Entity({ name: 'aiProviderCredential', schema: 'core' })
@ObjectType('AiProviderCredential')
@Check(
  'CHK_aiProviderCredential_encryptedApiKey_encrypted',
  `"encryptedApiKey" = '' OR "encryptedApiKey" LIKE 'enc:v2:%'`,
)
export class AiProviderCredentialEntity extends WorkspaceRelatedEntity {
  @Field()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ nullable: false, type: 'varchar', length: 255 })
  providerName: string;

  // Encrypted using SecretEncryptionService (enc:v2 envelope).
  // '' means "not configured".
  @Column({ nullable: false, type: 'text', default: '' })
  encryptedApiKey: EncryptedString | '';

  @Field()
  get isFilled(): boolean {
    return this.encryptedApiKey !== '';
  }

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

