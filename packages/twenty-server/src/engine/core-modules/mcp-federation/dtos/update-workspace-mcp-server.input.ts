import { Field, InputType } from '@nestjs/graphql';

import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Min,
} from 'class-validator';

import { WorkspaceMcpToolMode } from 'src/engine/core-modules/mcp-federation/entities/workspace-mcp-server.entity';
import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@InputType()
export class UpdateWorkspaceMcpServerInput {
  @Field(() => UUIDScalarType)
  @IsUUID()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  label?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  slug?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  authHeaderName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  authToken?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @Field(() => WorkspaceMcpToolMode, { nullable: true })
  @IsOptional()
  @IsEnum(WorkspaceMcpToolMode)
  toolMode?: WorkspaceMcpToolMode;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  toolAllowlist?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1000)
  timeoutMs?: number;
}
