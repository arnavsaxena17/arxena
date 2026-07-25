import { Field, HideField, InputType } from '@nestjs/graphql';

import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { RelationMetadataType } from 'src/engine/metadata-modules/relation-metadata/relation-metadata.entity';

@InputType()
export class CreateRelationInput {
  @IsEnum(RelationMetadataType)
  @IsNotEmpty()
  @Field(() => RelationMetadataType)
  relationType: RelationMetadataType;

  @IsUUID()
  @IsNotEmpty()
  @Field()
  fromObjectMetadataId: string;

  @IsUUID()
  @IsNotEmpty()
  @Field()
  toObjectMetadataId: string;

  @IsString()
  @IsNotEmpty()
  @Field()
  fromName: string;

  @IsString()
  @IsNotEmpty()
  @Field()
  toName: string;

  @IsString()
  @IsNotEmpty()
  @Field()
  fromLabel: string;

  @IsString()
  @IsNotEmpty()
  @Field()
  toLabel: string;

  @IsString()
  @IsOptional()
  @Field({ nullable: true })
  fromIcon?: string;

  @IsString()
  @IsOptional()
  @Field({ nullable: true })
  toIcon?: string;

  @IsString()
  @IsOptional()
  @Field({ nullable: true })
  fromDescription?: string;

  @IsString()
  @IsOptional()
  @Field({ nullable: true })
  toDescription?: string;

  @HideField()
  workspaceId: string;
}
