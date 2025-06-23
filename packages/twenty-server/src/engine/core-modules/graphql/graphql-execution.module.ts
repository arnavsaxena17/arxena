import { Module } from '@nestjs/common';
import { CoreGraphQLApiModule } from 'src/engine/api/graphql/core-graphql-api.module';
import { WorkspaceSchemaBuilderModule } from 'src/engine/api/graphql/workspace-schema-builder/workspace-schema-builder.module';
import { JwtModule } from '../jwt/jwt.module';
import { GraphQLExecutionService } from './graphql-execution.service';
import { StaticGraphQLService } from './static-graphql.service';

@Module({
  imports: [
    JwtModule,
    WorkspaceSchemaBuilderModule,
    CoreGraphQLApiModule,
  ],
  providers: [GraphQLExecutionService, StaticGraphQLService],
  exports: [GraphQLExecutionService, StaticGraphQLService],
})
export class GraphQLExecutionModule {} 