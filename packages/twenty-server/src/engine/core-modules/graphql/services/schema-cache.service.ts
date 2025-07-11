import { Injectable } from '@nestjs/common';
import { GraphQLSchema } from 'graphql';

type SchemaCacheEntry = {
  schema: GraphQLSchema;
  metadataVersion: number;
};

@Injectable()
export class SchemaCacheService {
  private schemaCache: Map<string, SchemaCacheEntry> = new Map();

  getSchema(workspaceId: string): SchemaCacheEntry | undefined {
    return this.schemaCache.get(workspaceId);
  }

  setSchema(workspaceId: string, schema: GraphQLSchema, metadataVersion: number): void {
    this.schemaCache.set(workspaceId, { schema, metadataVersion });
  }

  invalidateSchema(workspaceId: string): void {
    this.schemaCache.delete(workspaceId);
  }

  invalidateAll(): void {
    this.schemaCache.clear();
  }
} 