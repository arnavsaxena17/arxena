import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SecretEncryptionModule } from 'src/engine/core-modules/secret-encryption/secret-encryption.module';
import { AiProviderCredentialEntity } from 'src/engine/metadata-modules/ai/ai-provider-credentials/entities/ai-provider-credential.entity';
import { AiProviderCredentialsResolver } from 'src/engine/metadata-modules/ai/ai-provider-credentials/resolvers/ai-provider-credentials.resolver';
import { AiProviderCredentialsService } from 'src/engine/metadata-modules/ai/ai-provider-credentials/services/ai-provider-credentials.service';
import { PermissionsModule } from 'src/engine/metadata-modules/permissions/permissions.module';
import { provideWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/provide-workspace-scoped-repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiProviderCredentialEntity]),
    SecretEncryptionModule,
    PermissionsModule,
  ],
  providers: [
    AiProviderCredentialsResolver,
    AiProviderCredentialsService,
    provideWorkspaceScopedRepository(AiProviderCredentialEntity),
  ],
  exports: [AiProviderCredentialsService],
})
export class AiProviderCredentialsModule {}

