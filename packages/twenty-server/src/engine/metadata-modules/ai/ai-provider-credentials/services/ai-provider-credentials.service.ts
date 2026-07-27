import { Injectable } from '@nestjs/common';

import {
  type QueryDeepPartialEntity,
  type FindOptionsWhere,
} from 'typeorm';

import type { PlaintextString } from 'src/engine/core-modules/secret-encryption/branded-strings';
import { SecretEncryptionService } from 'src/engine/core-modules/secret-encryption/secret-encryption.service';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';

import { AiProviderCredentialEntity } from '../entities/ai-provider-credential.entity';

@Injectable()
export class AiProviderCredentialsService {
  constructor(
    private readonly secretEncryptionService: SecretEncryptionService,
    @InjectWorkspaceScopedRepository(AiProviderCredentialEntity)
    private readonly credentialRepository: WorkspaceScopedRepository<AiProviderCredentialEntity>,
  ) {}

  async findOne(
    workspaceId: string,
    providerName: string,
  ): Promise<AiProviderCredentialEntity | null> {
    return this.credentialRepository.findOneBy(workspaceId, {
      providerName,
    });
  }

  async getApiKeyForWorkspace(
    workspaceId: string,
    providerName: string,
  ): Promise<string | null> {
    const credential = await this.findOne(workspaceId, providerName);

    if (!credential || credential.encryptedApiKey === '') {
      return null;
    }

    return this.secretEncryptionService.decryptVersionedOrThrow(
      credential.encryptedApiKey,
      { workspaceId },
    );
  }

  async setApiKeyForWorkspace({
    workspaceId,
    providerName,
    apiKey,
  }: {
    workspaceId: string;
    providerName: string;
    apiKey: string | null | undefined;
  }): Promise<AiProviderCredentialEntity> {
    const encryptedApiKey =
      apiKey && apiKey.trim() !== ''
        ? this.secretEncryptionService.encryptVersioned(apiKey as PlaintextString, {
            workspaceId,
          })
        : '';

    const existing = await this.findOne(workspaceId, providerName);

    if (!existing) {
      return this.credentialRepository.save(workspaceId, {
        providerName,
        encryptedApiKey,
      });
    }

    await this.credentialRepository.update(
      workspaceId,
      { id: existing.id } as FindOptionsWhere<AiProviderCredentialEntity>,
      { encryptedApiKey } as QueryDeepPartialEntity<AiProviderCredentialEntity>,
    );

    const updated = await this.findOne(workspaceId, providerName);

    if (!updated) {
      // Defensive: should not happen due to the unique workspace+provider index.
      throw new Error(
        'AiProviderCredentialsService.setApiKeyForWorkspace: failed to persist credential',
      );
    }

    return updated;
  }

  async hasApiKeyConfigured(
    workspaceId: string,
    providerName: string,
  ): Promise<boolean> {
    const credential = await this.findOne(workspaceId, providerName);
    return credential?.encryptedApiKey !== '';
  }
}

