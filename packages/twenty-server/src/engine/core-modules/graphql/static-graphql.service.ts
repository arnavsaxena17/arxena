import { Injectable } from '@nestjs/common';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import { GraphQLExecutionService } from './graphql-execution.service';

@Injectable()
export class StaticGraphQLService {
  constructor(private moduleRef: ModuleRef) {}

  async executeGraphQL(query: string, variables: any, apiToken: string): Promise<any> {
    // Create a dummy context ID for the request scope
    const contextId = ContextIdFactory.create();
    
    // Get the request-scoped service
    const graphQLExecutionService = await this.moduleRef.resolve(
      GraphQLExecutionService,
      contextId,
      { strict: false },
    );

    return graphQLExecutionService.executeGraphQL(query, variables, apiToken);
  }
} 