import { Module } from '@nestjs/common';
import { CoreGraphQLApiModule } from 'src/engine/api/graphql/core-graphql-api.module';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';

import { GraphQLExecutionService } from './utils/utils';

@Module({
  imports: [
    CoreGraphQLApiModule,
    JwtModule,
  ],
  providers: [GraphQLExecutionService],
  exports: [GraphQLExecutionService],
})
export class GraphQLExecutionModule {} 